"""Calculator module — test fixture for propcheck Python support."""


def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


def divide(a: float, b: float) -> float:
    """Divide a by b.

    Args:
        a: Numerator
        b: Denominator (must not be zero)

    Returns:
        Result of a / b

    Raises:
        ZeroDivisionError: If b is zero
    """
    return a / b


def factorial(n: int) -> int:
    """Calculate n factorial.

    BUG: no check for negative input — infinite recursion.
    """
    if n <= 1:
        return 1
    return n * factorial(n - 1)
