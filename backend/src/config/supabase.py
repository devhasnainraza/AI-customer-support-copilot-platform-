"""
Supabase Client Initialization
T021: Supabase client configuration
"""
from supabase import create_client, Client
from src.config.settings import settings


class SupabaseClient:
    """Singleton Supabase client"""

    _instance: Client = None
    _service_instance: Client = None

    @classmethod
    def get_client(cls, use_service_role: bool = False) -> Client:
        """
        Get Supabase client instance

        Args:
            use_service_role: If True, use service role key (bypasses RLS)

        Returns:
            Supabase client instance
        """
        if use_service_role:
            if cls._service_instance is None:
                cls._service_instance = create_client(
                    settings.supabase_url,
                    settings.supabase_service_role_key
                )
            return cls._service_instance
        else:
            if cls._instance is None:
                cls._instance = create_client(
                    settings.supabase_url,
                    settings.supabase_anon_key
                )
            return cls._instance

    @classmethod
    def reset(cls):
        """Reset client instances (useful for testing)"""
        cls._instance = None
        cls._service_instance = None


# Convenience functions
def get_supabase_client(use_service_role: bool = False) -> Client:
    """Get Supabase client instance"""
    return SupabaseClient.get_client(use_service_role=use_service_role)


def get_service_client() -> Client:
    """Get Supabase client with service role (bypasses RLS)"""
    return SupabaseClient.get_client(use_service_role=True)
