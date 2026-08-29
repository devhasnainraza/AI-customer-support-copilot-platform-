# Backend package
import selectors

# Monkeypatch selectors to fix a known issue in Python 3.12/3.13 on Windows
# where unregistering a closed socket throws ValueError: Invalid file descriptor: -1
def patch_selector(selector_cls):
    if hasattr(selector_cls, 'unregister'):
        original_unregister = selector_cls.unregister
        def safe_unregister(self, fileobj):
            try:
                return original_unregister(self, fileobj)
            except ValueError as e:
                if "Invalid file descriptor: -1" in str(e):
                    return None
                raise e
        selector_cls.unregister = safe_unregister

if hasattr(selectors, 'SelectSelector'):
    patch_selector(selectors.SelectSelector)
if hasattr(selectors, 'DefaultSelector'):
    patch_selector(selectors.DefaultSelector)