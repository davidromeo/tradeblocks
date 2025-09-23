# TradeBlocks - Trading Analytics Platform

A comprehensive trading analytics platform built with FastAPI and Dash, featuring modern UI components from Dash Mantine Components. Build smarter trades with powerful analytics, one block at a time!

## Features

### 📊 Analysis Tabs

- **Geekistics** - Comprehensive portfolio statistics and combat stats by strategy
- **Performance Charts** - Cumulative returns, drawdown visualizations, rolling metrics
- **Correlation Matrix** - Strategy correlation analysis with interactive heatmaps
- **Monte Carlo Simulator** - Risk analysis through Monte Carlo simulations
- **Trade Data** - Interactive table with filtering, sorting, and export capabilities

### 🔧 Technical Features

- **Modern UI** - Built with Dash Mantine Components for a polished interface
- **File Upload** - Drag-and-drop CSV upload with validation
- **Interactive Charts** - Plotly-powered visualizations with hover details
- **Responsive Design** - Works on desktop and mobile devices
- **Real-time Updates** - Live data updates as you analyze your portfolio
- **Export Capabilities** - Download processed data and reports

## Tech Stack

- **Backend**: FastAPI 0.115.0+
- **Frontend**: Dash 3.2.0+ with Dash Mantine Components 2.2.1+
- **Data Processing**: Pandas 2.2.3+, NumPy 1.26.4+
- **Visualizations**: Plotly 5.24.1+
- **Deployment**: Vercel ready

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd tradeblocks

# One-command setup
./scripts/setup.sh

# Or manual setup with Poetry:
# poetry install --with dev
```

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings (optional for local development)
```

### 3. Set Up Development Tools (Optional)

```bash
# Install development dependencies (includes pre-commit, linting, etc.)
poetry install --with dev
poetry install --with analytics  # optional: SciPy + scikit-learn
poetry export --without-hashes -f requirements.txt -o requirements.txt  # for deployment bundles

# Need the heavier analytics stack locally?
poetry install --with analytics

# Install pre-commit hooks for automatic code quality checks
poetry run pre-commit install

# Run code quality checks locally
./scripts/check-code.sh

# Auto-fix common issues
./scripts/fix-code.sh
```

### 4. Run the Application

```bash
# Start the application
./scripts/start-dev.sh

# Or manually:
poetry run python app/main.py

# Or using uvicorn directly
poetry run uvicorn app.main:app --reload --port 8000
```

Navigate to `http://localhost:8000` to access the application.

## CSV Data Format

The application expects CSV files with the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| Date Opened | Trade open date | 2025-09-18 |
| Time Opened | Trade open time | 10:31:00 |
| Opening Price | Underlying price at open | 6655.17 |
| Legs | Option legs description | 5 Sep 18 6625 C BTO 32.95 \| 5 Sep 18 6685 C STO 1.00 |
| Premium | Net premium collected/paid | -3205 |
| P/L | Profit/Loss for the trade | -6850.6 |
| Strategy | Strategy name | "It's ORBin time!" |
| No. of Contracts | Number of contracts | 5 |
| Margin Req. | Margin requirement | 16025 |

See `sample-portfolio.csv` for a complete example.

## Testing with Your Own Data

TradeBlocks includes a comprehensive testing framework that allows you to test all calculations and features with your own trading data.

### Using Your Trading Data for Testing

1. **Add your data files** to the `tests/data/` directory:
   ```
   tests/data/
   ├── tradelog.csv         # Your trading data
   ├── dailylog.csv         # Your daily portfolio data (optional)
   └── README.md            # Testing documentation
   ```

2. **Required CSV format** for `tradelog.csv`:
   ```csv
   Date,Time,Symbol,Side,Quantity,Price,Commission,Proceeds,PnL,Strategy
   2024-01-15,09:30:00,AAPL,Buy,100,150.00,1.00,-15001.00,0.00,Momentum
   2024-01-15,15:45:00,AAPL,Sell,100,152.50,1.00,15248.00,246.00,Momentum
   ```

3. **Run comprehensive tests** with your data:
   ```bash
   # Test all performance calculations with your data
   PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/unit/test_performance_calculator.py -v

   # Run all tests with verbose output
   PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/ -v -s

   # Test specific calculations
   PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/unit/test_performance_calculator.py::TestPerformanceCalculator::test_real_data_performance_metrics -v -s
   ```

4. **What gets tested**:
   - ✅ All 7 Performance Blocks calculations (equity curve, trade distributions, streaks, etc.)
   - ✅ Data validation and format checking
   - ✅ Edge case handling with your actual trading patterns
   - ✅ Performance metrics calculation accuracy
   - ✅ Large dataset handling (if you have 1000+ trades)

5. **Privacy & Security**:
   - 🔒 Your data stays completely local - never transmitted anywhere
   - 🔒 User data files are automatically excluded from git commits
   - 🔒 All calculations run in-memory during testing only

### Test Output Example
```bash
$ PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/unit/test_performance_calculator.py::TestPerformanceCalculator::test_real_data_performance_metrics -v -s

Using real tradelog data: /path/to/tests/data/tradelog.csv
Loaded 1,247 trades for testing

Comprehensive performance summary for 1,247 trades:
  Total P/L: $45,678.90
  Winning trades: 672 (53.9%)
  Losing trades: 575 (46.1%)
  Average winner: $145.23
  Average loser: $-87.45
  ✓ All 7 performance calculations completed successfully
```

**Without your data files:**
```bash
Using mock tradelog data (no tradelog.csv found)
Loaded 5 trades for testing
✓ All calculations work with mock data
```

See `tests/data/README.md` for detailed instructions, troubleshooting, and data format requirements.

## Development

### Project Structure

```
app/
├── main.py                 # FastAPI + Dash integration
├── api/
│   └── portfolio.py        # API endpoints
├── dash_app/
│   ├── app.py             # Dash app initialization
│   ├── layouts/           # UI layouts
│   ├── components/        # Reusable components and tabs
│   └── callbacks/         # Interactive callbacks
├── data/
│   ├── models.py          # Pydantic models
│   ├── processor.py       # Portfolio data processing
│   └── daily_log_processor.py # Daily log processing
├── calculations/          # Portfolio analysis calculations
│   ├── geekistics.py     # Portfolio statistics
│   ├── performance.py    # Performance metrics
│   ├── correlation.py    # Strategy correlation analysis
│   └── monte_carlo.py    # Monte Carlo simulation
└── utils/
    ├── calculations.py    # Utility calculations
    └── advanced_stats.py  # Advanced statistical functions
```

### Adding New Features

1. **New Tab**: Create component in `app/dash_app/components/tabs/`
2. **New API Endpoint**: Add to `app/api/portfolio.py`
3. **New Calculation**: Add to `app/calculations/` (organized by feature)
4. **New Callback**: Add to appropriate file in `app/dash_app/callbacks/`

## Deployment

### Vercel (Recommended)

TradeBlocks is optimized for Vercel deployment:

1. **Connect Repository:**
   ```bash
   # Push to GitHub
   git push origin master
   ```

2. **Deploy to Vercel:**
   - Visit [vercel.com](https://vercel.com)
   - Import your `tradeblocks` repository
   - Vercel will automatically detect the Python app
   - Deploy with default settings

3. **Environment Variables (Optional):**
   - Set any required environment variables in Vercel dashboard
   - Most features work without additional configuration

### Manual Deployment

For other platforms:

```bash
# Build and run with gunicorn (production)
poetry run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## API Documentation

Once running, visit:
- **API Docs**: `http://localhost:8000/docs` (Swagger UI)
- **Alternative Docs**: `http://localhost:8000/redoc`

### Key Endpoints

- `POST /api/v1/portfolio/upload` - Upload portfolio CSV
- `GET /api/v1/portfolio/{id}/stats` - Get portfolio statistics
- `GET /api/v1/portfolio/{id}/trades` - Get trade data
- `POST /api/v1/portfolio/{id}/monte-carlo` - Run Monte Carlo simulation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or issues:
1. Check the GitHub Issues page
2. Create a new issue with detailed description
3. Include sample data (anonymized) if relevant

---

Built with 🧱 using FastAPI, Dash, and Dash Mantine Components
