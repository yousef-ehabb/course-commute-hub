import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });

  async function testFlow(role, email, password, targetUrl) {
    console.log(`\n================================`);
    console.log(`Testing ${role} Flow: ${email}`);
    console.log(`================================`);

    const context = await browser.newContext();
    const page = await context.newPage();

    let permissionErrors = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("permission_denied")) {
        permissionErrors.push(text);
        console.error(`[CONSOLE ERROR] ${text}`);
      }
    });

    console.log(`[1] Navigating to login page...`);
    await page.goto("http://localhost:8080/login");

    console.log(`[2] Logging in...`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    console.log(`[3] Waiting for navigation to dashboard...`);
    // Wait for URL to change away from login
    await page.waitForURL((url) => !url.toString().includes("login"), { timeout: 10000 });

    console.log(`[4] Current URL: ${page.url()}`);

    console.log(`[5] Navigating to ${targetUrl}...`);
    await page.goto(`http://localhost:8080${targetUrl}`);
    await page.waitForLoadState("networkidle");

    // Wait a couple of seconds to ensure all Firebase subscriptions are fired
    await page.waitForTimeout(3000);

    if (permissionErrors.length > 0) {
      console.log(`\n❌ FAILED: Found ${permissionErrors.length} permission errors.`);
    } else {
      console.log(`\n✅ PASSED: No permission errors found in the console.`);
    }

    await context.close();
    return permissionErrors.length === 0;
  }

  try {
    const adminPass = await testFlow("Admin", "admin@rakeb.com", "admin123", "/admin/stations");

    // We need a student account. We created one earlier: test_new_user_1785081763978@example.com / password123
    const studentPass = await testFlow(
      "Student",
      "test_new_user_1785081763978@example.com",
      "password123",
      "/student",
    );

    if (adminPass && studentPass) {
      console.log("\n🌟 ALL TESTS PASSED SUCCESSFULLY 🌟");
      process.exit(0);
    } else {
      console.log("\n❌ SOME TESTS FAILED");
      process.exit(1);
    }
  } catch (e) {
    console.error("\n💥 FATAL ERROR during tests:", e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
