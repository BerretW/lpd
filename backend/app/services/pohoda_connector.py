# app/services/pohoda_connector.py
import httpx
import xml.etree.ElementTree as ET
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import CompanyPohodaSettings, Client

# Namespaces pro parsování odpovědi
NS = {
    'dat': 'http://www.stormware.cz/schema/version_2/data.xsd',
    'adb': 'http://www.stormware.cz/schema/version_2/addressbook.xsd',
    'typ': 'http://www.stormware.cz/schema/version_2/type.xsd',
    'lAdb': 'http://www.stormware.cz/schema/version_2/list_addbook.xsd'
}

async def sync_clients_from_pohoda(db: AsyncSession, company_id: int):
    # 1. Načtení nastavení
    settings = await db.get(CompanyPohodaSettings, company_id)
    if not settings or not settings.mserver_url:
        raise ValueError("Není nastaven mServer URL pro tuto společnost.")

    # 2. Sestavení XML dotazu (ListRequest pro Adresář)
    xml_request = f"""
    <dat:dataPack version="2.0" id="REQ-001" ico="{settings.ico_of_accounting_entity or ''}" application="Appartus" note="Sync Clients" xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd" xmlns:lst="http://www.stormware.cz/schema/version_2/list.xsd" xmlns:flt="http://www.stormware.cz/schema/version_2/filter.xsd">
        <dat:dataPackItem id="I001" version="2.0">
            <lst:listAddressBookRequest version="2.0">
                <lst:requestAddressBook>
                    <flt:filter>
                        <flt:all/>
                    </flt:filter>
                </lst:requestAddressBook>
            </lst:listAddressBookRequest>
        </dat:dataPackItem>
    </dat:dataPack>
    """

    # 3. Odeslání požadavku na mServer
    headers = {"Content-Type": "text/xml", "STW-Authorization": _get_auth_header(settings)}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(settings.mserver_url, content=xml_request, headers=headers)
            response.raise_for_status()
        except httpx.RequestError as e:
            raise ValueError(f"Chyba připojení k mServeru: {e}")

    # 4. Zpracování XML odpovědi
    return await _process_pohoda_response(db, company_id, response.content)

def _get_auth_header(settings):
    import base64
    if settings.mserver_user and settings.mserver_password:
        auth_str = f"{settings.mserver_user}:{settings.mserver_password}"
        return f"Basic {base64.b64encode(auth_str.encode()).decode()}"
    return ""

async def _process_pohoda_response(db: AsyncSession, company_id: int, xml_content: bytes):
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError:
        raise ValueError("Odpověď z Pohody není validní XML.")

    # Najdeme odpověď adresáře
    # Cesta: dataPack -> dataPackItem -> listAddressBook -> addressbook
    addressbooks = root.findall('.//lAdb:listAddressBook/lAdb:addressbook', NS)
    
    if not addressbooks:
        # Zkusíme zjistit chybu v responsePackItem
        state = root.find('.//dat:dataPackItem', NS)
        if state is not None and state.get('state') == 'error':
            error_msg = state.find('.//dat:note', NS)
            raise ValueError(f"Chyba Pohody: {error_msg.text if error_msg is not None else 'Neznámá chyba'}")
        return 0

    updated_count = 0
    
    for ab in addressbooks:
        # Parsování polí
        # ID v Pohodě
        pohoda_id = ab.find('.//adb:id', NS)
        ext_id = pohoda_id.text if pohoda_id is not None else None
        
        # Identita
        identity = ab.find('.//adb:identity', NS)
        address_node = identity.find('.//typ:address', NS) if identity is not None else None
        
        if address_node is None:
            continue

        company_name = _get_text(address_node, 'typ:company')
        name_field = _get_text(address_node, 'typ:name')
        
        # Složení jména (pokud není firma, použijeme jméno osoby)
        final_name = company_name if company_name else name_field
        if not final_name: 
            continue

        ico = _get_text(address_node, 'typ:ico')
        dic = _get_text(address_node, 'typ:dic')
        street = _get_text(address_node, 'typ:street')
        city = _get_text(address_node, 'typ:city')
        zip_code = _get_text(address_node, 'typ:zip')
        
        full_address = f"{street}, {zip_code} {city}".strip(", ")

        # Kontakty
        email = _get_text(identity, './/typ:email') # Pohoda má email často v adresy nebo v tel
        phone = _get_text(identity, './/typ:phone')

        # 5. Upsert do databáze (Update or Insert)
        # Hledáme podle pohoda_ext_id, pokud není, tak podle IČO, pokud není, tak podle jména
        client = None
        
        if ext_id:
            stmt = select(Client).where(Client.company_id == company_id, Client.pohoda_ext_id == ext_id)
            client = (await db.execute(stmt)).scalar_one_or_none()
        
        if not client and ico:
            stmt = select(Client).where(Client.company_id == company_id, Client.ico == ico)
            client = (await db.execute(stmt)).scalar_one_or_none()

        if client:
            # UPDATE
            client.name = final_name
            client.address = full_address
            client.ico = ico
            client.dic = dic
            client.email = email or client.email # Nepřepisovat prázdným
            client.phone = phone or client.phone
            client.pohoda_ext_id = ext_id
        else:
            # INSERT
            client = Client(
                company_id=company_id,
                name=final_name,
                address=full_address,
                ico=ico,
                dic=dic,
                email=email,
                phone=phone,
                pohoda_ext_id=ext_id
            )
            db.add(client)
        
        updated_count += 1

    await db.commit()
    return updated_count

def _get_text(element, path):
    found = element.find(path, NS)
    return found.text if found is not None else None