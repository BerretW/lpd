# app/schemas/category.py
from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class CategoryBase(BaseModel):
    name: str

class CategoryCreateIn(CategoryBase):
    parent_id: Optional[int] = None

class CategoryUpdateIn(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

# NOVÉ: Jednoduché schéma pro odpovědi na POST/PATCH
class CategorySimpleOut(CategoryBase):
    id: int
    parent_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# Původní rekurzivní schéma pro GET (listování stromu)
class CategoryOut(CategoryBase):
    id: int
    parent_id: Optional[int] = None
    children: List['CategoryOut'] = []
    model_config = ConfigDict(from_attributes=True)