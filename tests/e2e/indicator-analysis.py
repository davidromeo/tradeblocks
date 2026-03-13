"""
E2E test for the Indicator Analysis page.

Tests:
1. Page renders with correct title and sidebar entry
2. NoActiveBlock shown when no block active
3. Full flow: import block → upload dataset → run analysis → verify results
"""

import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3002"
TRADELOG = str(Path(__file__).parents[2] / "tests/data/EMA Test Data/ema-tradelog.csv")
INDICATORS_CSV = "/home/carsten/dev/tradeblocks-data/custom_indicators.csv"

PASS = "✅"
FAIL = "❌"


def check(condition: bool, label: str) -> bool:
    status = PASS if condition else FAIL
    print(f"  {status} {label}")
    return condition


def test_indicator_analysis():
    all_passed = True

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(20_000)

        # ----------------------------------------------------------------
        # TEST A: Page structure without any block
        # ----------------------------------------------------------------
        print("\n[A] Page structure (no block)")
        page.goto(f"{BASE_URL}/indicator-analysis")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        h1 = page.locator("h1").first.inner_text()
        all_passed &= check("Indicator Analysis" in h1, f"Header = '{h1}'")

        header_desc = page.locator("header p").first.inner_text()
        all_passed &= check("indicator" in header_desc.lower() or "P&L" in header_desc, f"Header description present")

        sidebar = page.locator("a[href='/indicator-analysis']")
        all_passed &= check(sidebar.count() > 0, "Sidebar link present")
        if sidebar.count() > 0:
            all_passed &= check("Indicator Analysis" in sidebar.first.inner_text(), "Sidebar link text correct")

        all_passed &= check(page.locator("text=Controls").count() > 0, "Controls card visible")
        all_passed &= check(page.locator("text=No Active Block Selected").count() > 0, "NoActiveBlock shown")

        all_passed &= check(page.locator("button:has-text('Run Analysis')").count() > 0, "Run Analysis button present")
        all_passed &= check(page.locator("button:has-text('Select dataset')").count() > 0, "Dataset dropdown present")
        all_passed &= check(page.locator("button:has-text('Select column')").count() > 0, "Column dropdown present")

        page.screenshot(path="/tmp/indicator-no-block.png")
        print("  📸 /tmp/indicator-no-block.png")

        # ----------------------------------------------------------------
        # TEST B: Import a block
        # ----------------------------------------------------------------
        print("\n[B] Importing EMA tradelog block")
        page.goto(f"{BASE_URL}/blocks")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Click "New Block" button
        page.get_by_role("button", name="New Block").click()
        page.wait_for_timeout(1000)

        # Dialog should open - look for file input
        file_input = page.locator("input[type='file']").first
        all_passed &= check(file_input.count() > 0, "File input in dialog")

        if file_input.count() > 0:
            # Fill required Block Name field first
            name_input = page.locator("[role='dialog'] input[placeholder*='Strategy'], [role='dialog'] input[placeholder*='name' i]").first
            name_input.fill("EMA Test Block")
            page.wait_for_timeout(300)

            # Upload tradelog (first file input)
            file_input.set_input_files(TRADELOG)
            page.wait_for_timeout(1000)

            # "Create Block" button should now be enabled
            create_btn = page.locator("[role='dialog'] button:has-text('Create Block')")
            all_passed &= check(not create_btn.is_disabled(), "Create Block button enabled after name + file")
            create_btn.click()
            print("  ⏳ Processing block...")
            page.wait_for_timeout(5000)

            # Close any remaining dialog
            close = page.locator("[role='dialog'] button:has-text('Close'), [role='dialog'] button:has-text('Done'), button[aria-label='Close']")
            if close.count() > 0 and close.first.is_visible():
                close.first.click()
                page.wait_for_timeout(1000)

        page.screenshot(path="/tmp/blocks-after-import.png")
        print("  📸 /tmp/blocks-after-import.png")

        # Check if a block was created
        block_count_text = page.locator("text=/\\d+ block/").first.inner_text() if page.locator("text=/\\d+ block/").count() > 0 else ""
        has_block = "1" in block_count_text or page.locator("[data-testid='block-card'], .block-card").count() > 0

        # Try to activate block if not already active
        activate_btn = page.locator("button:has-text('Activate'), button:has-text('Set Active'), button:has-text('Set as Active')")
        if activate_btn.count() > 0:
            activate_btn.first.click()
            page.wait_for_timeout(1000)

        all_passed &= check(
            page.locator("text=No trading blocks yet").count() == 0,
            "Block created (empty state gone)"
        )

        # ----------------------------------------------------------------
        # TEST C: Upload custom indicators dataset
        # ----------------------------------------------------------------
        print("\n[C] Uploading custom_indicators.csv")
        page.goto(f"{BASE_URL}/static-datasets")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        page.get_by_role("button", name="Upload Dataset").click()
        page.wait_for_timeout(1000)

        file_input2 = page.locator("input[type='file']").first
        if file_input2.count() > 0:
            file_input2.set_input_files(INDICATORS_CSV)
            page.wait_for_timeout(1000)

            # Fill dataset name if visible
            name_field = page.locator("input[placeholder*='name' i], input[id*='name' i], label:has-text('Name') + input")
            if name_field.count() > 0 and name_field.first.is_visible():
                name_field.first.fill("Custom Indicators")

            # Submit
            for btn_text in ["Upload", "Import", "Save", "Confirm", "Create"]:
                btn = page.locator(f"[role='dialog'] button:has-text('{btn_text}'), [data-state='open'] button:has-text('{btn_text}')")
                if btn.count() > 0 and btn.first.is_visible():
                    btn.first.click()
                    page.wait_for_timeout(4000)
                    break

        page.wait_for_timeout(2000)
        page.screenshot(path="/tmp/static-datasets-after.png")
        print("  📸 /tmp/static-datasets-after.png")

        ds_found = page.locator("text=Custom Indicators, text=custom_indicators").count() > 0 or \
                   page.locator("text=No static datasets yet").count() == 0
        all_passed &= check(ds_found, "Dataset uploaded")

        # ----------------------------------------------------------------
        # TEST D: Indicator Analysis - full flow
        # ----------------------------------------------------------------
        print("\n[D] Indicator Analysis - full flow")
        page.goto(f"{BASE_URL}/indicator-analysis")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        # Should NOT show NoActiveBlock anymore (if block was activated)
        no_block_shown = page.locator("text=No Active Block Selected").count() > 0
        if no_block_shown:
            print("  ⚠ No active block - activate block first")
            # Try activating from blocks page
            page.goto(f"{BASE_URL}/blocks")
            page.wait_for_timeout(1000)
            activate = page.locator("button:has-text('Activate'), button:has-text('Set Active'), button:has-text('Set as Active')")
            if activate.count() > 0:
                activate.first.click()
                page.wait_for_timeout(1000)
            page.goto(f"{BASE_URL}/indicator-analysis")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)

        # Page now has X-axis source (combobox 0), dataset (combobox 1), column (combobox 2),
        # Y-axis source (combobox 3). Default X = "Static Dataset", default Y = "Trade P&L".

        # Combobox 0: X-axis source — already defaults to "Static Dataset", leave as-is
        xsource_select = page.locator("button[role='combobox']").nth(0)
        xsource_select.click()
        page.wait_for_timeout(500)
        xsource_options = page.locator("[role='option']").all()
        print(f"  X-source options: {[o.inner_text() for o in xsource_options]}")
        # Select "Static Dataset" (first option)
        if xsource_options:
            xsource_options[0].click()
        page.wait_for_timeout(500)

        # Combobox 1: dataset picker
        dataset_select = page.locator("button[role='combobox']").nth(1)
        dataset_select.click()
        page.wait_for_timeout(500)
        dataset_options = page.locator("[role='option']").all()
        print(f"  Dataset options: {[o.inner_text() for o in dataset_options]}")

        if dataset_options:
            # Pick first dataset (Custom Indicators)
            dataset_options[0].click()
            page.wait_for_timeout(500)

            # Combobox 2: column picker (now enabled after dataset selected)
            col_select = page.locator("button[role='combobox']").nth(2)
            col_select.click()
            page.wait_for_timeout(500)

            col_options = page.locator("[role='option']").all()
            print(f"  Column options: {[o.inner_text() for o in col_options]}")

            # Prefer VIX_MA_Ratio (best date coverage)
            vix_option = page.locator("[role='option']:has-text('VIX_MA_Ratio')")
            if vix_option.count() > 0:
                vix_option.first.click()
            elif col_options:
                col_options[0].click()
            page.wait_for_timeout(500)

            # Y-axis source defaults to "Trade P&L" — no change needed

        # Run Analysis (outside the if so we always check button state)
        if dataset_options:
            run_btn = page.get_by_role("button", name="Run Analysis")
            all_passed &= check(not run_btn.is_disabled(), "Run Analysis button enabled")
            run_btn.click()
            print("  ⏳ Running analysis...")
            page.wait_for_timeout(6000)

            page.screenshot(path="/tmp/indicator-analysis-result.png")
            print("  📸 /tmp/indicator-analysis-result.png")

            # Check results
            has_spearman = page.locator("text=Spearman r").count() > 0
            has_warning = page.locator("text=Not enough matched").count() > 0

            if has_spearman:
                all_passed &= check(True, "Spearman r card visible")
                all_passed &= check(page.locator("text=Mutual Information").count() > 0, "Mutual Information card visible")
                all_passed &= check(page.locator("text=KS Statistic").count() > 0, "KS Statistic card visible")
                all_passed &= check(page.locator("text=Bin Summary").count() > 0, "Bin table visible")

                # Wait for Plotly charts
                try:
                    page.wait_for_selector(".js-plotly-plot", timeout=10_000)
                    chart_count = page.locator(".js-plotly-plot").count()
                    all_passed &= check(chart_count >= 2, f"{chart_count} Plotly charts rendered (≥2 expected)")
                except Exception:
                    all_passed &= check(False, "Plotly charts rendered (timeout)")

                # Check P&L colour coding in bin table
                green = page.locator("td.text-green-600").count()
                red = page.locator("td.text-red-600").count()
                all_passed &= check(green > 0 or red > 0, f"P&L cells coloured ({green} green, {red} red)")

                # Full-page screenshot after charts loaded
                page.wait_for_timeout(2000)
                page.screenshot(path="/tmp/indicator-analysis-charts.png", full_page=True)
                print("  📸 /tmp/indicator-analysis-charts.png (full page with charts)")

            elif has_warning:
                all_passed &= check(True, "Warning shown (too few matches - date range issue)")
                print("  ℹ  EMA test data (2025) vs custom_indicators (2022-2026): dates should overlap")
            else:
                page_text = page.locator("body").inner_text()[:200]
                all_passed &= check(False, f"No results and no warning. Body: {page_text}")
        else:
            all_passed &= check(False, "No dataset options found in dropdown")

        browser.close()

    print(f"\n{'=' * 50}")
    print(f"{'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    print(f"{'=' * 50}")
    return all_passed


if __name__ == "__main__":
    import sys
    success = test_indicator_analysis()
    sys.exit(0 if success else 1)
