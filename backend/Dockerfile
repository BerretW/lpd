FROM python:3.12-slim

# Instalace systémových závislostí včetně MySQL klienta (mariadb-client funguje i pro MySQL 8)
RUN apt-get update && apt-get install -y \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Vytvoření složky pro zálohy
RUN mkdir -p /app/backups

COPY app ./app
COPY static ./static
# Pokud používáte složku plugins, zkopírujte ji také
COPY plugins ./plugins 

ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]