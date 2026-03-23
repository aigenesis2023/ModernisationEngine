import { StitchToolClient } from "@google/stitch-sdk";

// Use the low-level client for full control and visibility
const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300000
});

async function run() {
  // Step 1: Create project
  console.log("1. Creating project...");
  const project = await client.callTool("create_project", { title: "ModEngine Brand DNA Test" });
  console.log("Project:", JSON.stringify(project, null, 2));
  const projectId = project.name?.replace("projects/", "") || project.projectId;
  console.log("Project ID:", projectId);

  // Step 2: Generate a screen with brand-specific prompt
  console.log("\n2. Generating screen (may take 1-3 min)...");
  const result = await client.callTool("generate_screen_from_text", {
    projectId,
    prompt: `Design a premium component style guide page showing these UI components for an e-learning platform:

1. A HERO SECTION - full-width, dark background, large bold title "Electric Vehicle Safety", subtitle, gradient accent line
2. An ACCORDION component - 3 expandable panels with chevron icons, glass-morphism cards
3. A STAT CALLOUT - 3 large animated numbers (e.g. "98%", "4.2M", "150+") with labels below
4. A BENTO GRID - 4 cards in a modern grid layout with subtle hover states

BRAND AESTHETIC:
- Dark background: #383838
- Primary blue: #0099ff
- Secondary pink: #ff3c71
- Font: Satoshi for headings, Inter for body
- Style: glass-morphism, subtle gradients, generous whitespace
- Mood: premium tech, creative, modern
- Border radius: 16px
- Cards: frosted glass effect with subtle borders`,
    deviceType: "DESKTOP",
    modelId: "GEMINI_3_FLASH"
  });

  console.log("\n=== RAW RESULT KEYS ===");
  console.log(Object.keys(result));
  console.log("\n=== FULL RAW RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  // Extract screen data
  if (result.outputComponents) {
    for (const comp of result.outputComponents) {
      if (comp.design?.screens) {
        for (const screen of comp.design.screens) {
          console.log("\n=== SCREEN DATA ===");
          console.log("Screen ID:", screen.id || screen.name);
          console.log("All screen keys:", Object.keys(screen));

          if (screen.htmlCode?.downloadUrl) {
            console.log("\nHTML URL:", screen.htmlCode.downloadUrl);
            // Fetch actual HTML
            const resp = await fetch(screen.htmlCode.downloadUrl);
            const html = await resp.text();
            console.log("HTML length:", html.length);
            console.log("\n=== FULL HTML ===\n");
            console.log(html);
          }

          if (screen.screenshot?.downloadUrl) {
            console.log("\nScreenshot URL:", screen.screenshot.downloadUrl);
          }
        }
      }
      // Check for suggestions or other data
      if (comp.suggestions) {
        console.log("\n=== SUGGESTIONS ===");
        console.log(JSON.stringify(comp.suggestions, null, 2));
      }
    }
  }

  await client.close();
}

run().catch(err => {
  console.error("FATAL:", err.message);
  console.error(err.stack);
});
