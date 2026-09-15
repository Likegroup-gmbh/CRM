const SCREENSHOT_BUCKET = 'strategie-screenshots';

function extractStrategieScreenshotPath(url) {
  if (!url) return null;
  const match = String(url).match(/strategie-screenshots\/(.+)$/);
  return match ? match[1] : null;
}

function findUnreferencedScreenshotPaths(objectNames, referencedUrls) {
  const referenced = new Set(
    (referencedUrls || []).map(extractStrategieScreenshotPath).filter(Boolean)
  );
  return (objectNames || []).filter((name) => name && !referenced.has(name));
}

async function deletePreviousScreenshot(supabase, previousUrl, newUrl) {
  const oldPath = extractStrategieScreenshotPath(previousUrl);
  const newPath = extractStrategieScreenshotPath(newUrl);
  if (!oldPath || oldPath === newPath) return false;

  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).remove([oldPath]);
  if (error) {
    console.warn(`Alter Screenshot nicht geloescht (${oldPath}): ${error.message}`);
    return false;
  }
  return true;
}

module.exports = {
  SCREENSHOT_BUCKET,
  extractStrategieScreenshotPath,
  findUnreferencedScreenshotPaths,
  deletePreviousScreenshot
};
