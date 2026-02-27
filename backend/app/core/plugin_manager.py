# backend/app/core/plugin_manager.py
from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)

class PluginManager:
    def __init__(self, app: FastAPI):
        self.app = app
        self.plugins = []

    def register_plugin(self, plugin_module):
        """
        Registruje plugin. Očekává modul, který má funkci 'setup(app)'.
        """
        try:
            if hasattr(plugin_module, "setup"):
                plugin_module.setup(self.app)
                self.plugins.append(plugin_module.__name__)
                logger.info(f"Plugin loaded: {plugin_module.__name__}")
            else:
                logger.warning(f"Plugin {plugin_module.__name__} has no setup() function.")
        except Exception as e:
            logger.error(f"Failed to load plugin {plugin_module}: {e}")