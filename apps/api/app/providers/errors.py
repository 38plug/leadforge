class ProviderError(Exception):
    """
    Base error for all provider failures. Never let a provider exception
    bubble up as an unhandled 500 — routers should catch ProviderError and
    translate it into a structured, retryable-aware JSON error response.
    """

    def __init__(self, code: str, message: str, retryable: bool = False):
        self.code = code
        self.message = message
        self.retryable = retryable
        super().__init__(message)

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "retryable": self.retryable}


class ProviderUnavailableError(ProviderError):
    def __init__(self, provider_name: str):
        super().__init__(
            code="PROVIDER_UNAVAILABLE",
            message=f"{provider_name} is temporarily unavailable",
            retryable=True,
        )
