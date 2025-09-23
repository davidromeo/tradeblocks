# Contributing to TradeBlocks

Thank you for your interest in contributing to TradeBlocks! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/tradeblocks.git
   cd tradeblocks
   ```

2. **Set up development environment**
   ```bash
   ./scripts/setup.sh
   ```
   This will:
   - Create a virtual environment
   - Install all dependencies
   - Set up pre-commit hooks
   - Create `.env` file from template

3. **Start development server**
   ```bash
   ./scripts/start-dev.sh
   ```

## 📋 Development Workflow

### 1. Before You Start

- Check existing [issues](https://github.com/your-username/portfolio-analyzer/issues) and [pull requests](https://github.com/your-username/portfolio-analyzer/pulls)
- Create an issue to discuss major changes before implementing
- Fork the repository and create a feature branch

### 2. Making Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code, code, code ...

# Run tests and checks (if available)
pytest tests/
black app/
ruff check app/

# Commit your changes (pre-commit hooks will run automatically)
git commit -m "feat: add your feature description"
```

### 3. Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the README if needed
5. Submit a pull request with a clear description

## 🏗️ Project Structure

```
app/
├── main.py                 # FastAPI application entry point
├── api/                    # API endpoints
├── dash_app/              # Dash frontend
│   ├── app.py             # Dash app initialization
│   ├── layouts/           # UI layouts
│   ├── components/        # Reusable components
│   └── callbacks/         # Interactive callbacks
├── data/                  # Data models and processing
│   ├── models.py          # Pydantic models
│   ├── processor.py       # Portfolio CSV processing
│   └── daily_log_processor.py # Daily log processing
├── calculations/          # Portfolio analysis calculations
│   ├── geekistics.py     # Portfolio statistics
│   ├── performance.py    # Performance metrics
│   ├── correlation.py    # Strategy correlation analysis
│   └── monte_carlo.py    # Monte Carlo simulations
└── utils/                 # Utility functions
    ├── calculations.py    # General calculations
    └── advanced_stats.py  # Advanced statistical functions

tests/
├── unit/                  # Unit tests
├── integration/           # Integration tests
└── fixtures/              # Test data
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests (if test files exist)
pytest tests/

# Run specific test file
pytest tests/unit/test_models.py

# Run tests with verbose output
pytest -v

# Run with coverage (if pytest-cov installed)
pytest --cov=app tests/
```

### Writing Tests

- Place unit tests in `tests/unit/`
- Place integration tests in `tests/integration/`
- Use fixtures defined in `tests/conftest.py`
- Aim for >70% code coverage

### Test Guidelines

```python
def test_function_name():
    """Test description explaining what is being tested"""
    # Arrange
    input_data = create_test_data()

    # Act
    result = function_under_test(input_data)

    # Assert
    assert result.some_property == expected_value
```

## 🎨 Code Style

We use automated code formatting and linting:

```bash
# Format code
black app/

# Check code style
ruff check app/

# Available via scripts:
./scripts/start-dev.sh  # Start development server
./scripts/setup.sh      # Initial setup
```

### Style Guidelines

- **Python**: Follow PEP 8, use Black formatter (100 char line length)
- **Type Hints**: Use type hints for all public functions
- **Docstrings**: Use Google-style docstrings
- **Imports**: Use absolute imports, organized by isort
- **Variables**: Use descriptive names, avoid abbreviations

### Example Code

```python
from typing import List, Optional
from app.data.models import Trade, Portfolio


def calculate_portfolio_stats(
    trades: List[Trade],
    strategy_filter: Optional[str] = None
) -> dict:
    """Calculate portfolio statistics for given trades.

    Args:
        trades: List of trade objects to analyze
        strategy_filter: Optional strategy name to filter trades

    Returns:
        Dictionary containing portfolio statistics

    Raises:
        ValueError: If trades list is empty
    """
    if not trades:
        raise ValueError("Trades list cannot be empty")

    # Implementation here...
    return stats
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `./scripts/setup.sh` | One-time development setup |
| `./scripts/start-dev.sh` | Start development server |
| `python app/main.py` | Run application directly |
| `pytest tests/` | Run tests (if available) |
| `black app/` | Format code |
| `ruff check app/` | Check code style |

## 📝 Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(api): add portfolio upload endpoint
fix(dash): resolve callback circular dependency
docs(readme): update installation instructions
test(models): add tests for Portfolio model
```

## 🐛 Reporting Issues

When reporting issues, please include:

1. **Environment information**:
   - Python version
   - Operating system
   - Browser (for UI issues)

2. **Steps to reproduce**:
   - Exact steps taken
   - Expected behavior
   - Actual behavior

3. **Additional context**:
   - Screenshots (for UI issues)
   - Error logs
   - Sample data (anonymized)

## 💡 Adding New Features

### API Endpoints

1. Add endpoint to `app/api/portfolio.py`
2. Update OpenAPI documentation
3. Add tests in `tests/integration/test_api.py`

### Dashboard Components

1. Create component in `app/dash_app/components/`
2. Add callback in `app/dash_app/callbacks/`
3. Update main layout if needed
4. Add tests

### Data Models

1. Define Pydantic model in `app/data/models.py`
2. Update processor in `app/data/processor.py`
3. Add validation tests

## 🚢 Deployment

### Local Development

```bash
# Standard development
./scripts/start-dev.sh

# Or directly
python app/main.py

# With Docker (if configured)
docker-compose up
```

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Dash Documentation](https://dash.plotly.com/)
- [Dash Mantine Components](https://www.dash-mantine-components.com/)
- [Plotly Documentation](https://plotly.com/python/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Focus on what's best for the community
- Show empathy towards other contributors
- Accept constructive criticism gracefully

## ❓ Getting Help

- Check existing [documentation](README.md)
- Search [existing issues](https://github.com/your-username/portfolio-analyzer/issues)
- Join discussions in [GitHub Discussions](https://github.com/your-username/portfolio-analyzer/discussions)
- Create a new issue with detailed information

## 🏆 Recognition

Contributors will be acknowledged in:
- GitHub Contributors list
- Release notes for significant contributions
- README.md contributors section

Thank you for contributing to TradeBlocks! 🧱
