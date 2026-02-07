/**
 * API Key Management
 */

/**
 * Saves a new API key for the given provider
 */
export async function saveApiKey(provider: string) {
  const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
  const key = input?.value?.trim();

  if (!key) {
    alert(`Please enter a ${provider} API key first`);
    return;
  }

  try {
    await window.settingsAPI.setApiKey(provider, key);
    input.value = '';
    updateApiKeyStatus(provider, true);
    alert(`✅ ${provider} API key saved securely!`);
  } catch (e: unknown) {
    console.error(`Failed to save ${provider} API key:`, e);
    let errorMsg = e instanceof Error ? e.message : String(e);
    const ipcPrefix = /^Error invoking remote method '[^']+': Error: /;
    errorMsg = errorMsg.replace(ipcPrefix, '');
    alert(`❌ Failed to save ${provider} API key\n\nThe API key format is invalid. ${errorMsg}`);
  }
}

/**
 * Tests the API key currently in the input field
 */
export async function testCurrentApiKey(provider: string) {
  const input = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
  const key = input?.value?.trim();

  if (!key) {
    alert(`Please enter a ${provider} API key to test`);
    return;
  }

  try {
    const result = await window.settingsAPI.testApiKey(provider, key);
    if (result.success) {
      alert(`✅ ${provider} API key is valid!`);
    } else {
      alert(`❌ ${provider} API key test failed: ${result.error}`);
    }
  } catch (e: unknown) {
    alert(`❌ Test failed: ${e}`);
  }
}

/**
 * Tests the saved API key
 */
export async function testSavedApiKey(provider: string) {
  try {
    const result = await window.settingsAPI.testApiKey(provider, '');
    if (result.success) {
      alert(`✅ ${provider} API key is valid!`);
    } else {
      alert(`❌ ${provider} API key test failed: ${result.error}`);
    }
  } catch (e: unknown) {
    alert(`❌ Test failed: ${e}`);
  }
}

/**
 * Deletes the saved API key
 */
export async function deleteApiKey(provider: string) {
  if (!confirm(`Delete ${provider} API key? This cannot be undone.`)) {
    return;
  }

  try {
    await window.settingsAPI.setApiKey(provider, '');
    updateApiKeyStatus(provider, false);
    alert(`🗑️ ${provider} API key deleted`);
  } catch (e: unknown) {
    console.error(`Failed to delete ${provider} API key:`, e);
    alert(`❌ Failed to delete ${provider} API key`);
  }
}

/**
 * Updates the UI visibility based on whether a key is saved
 */
export function updateApiKeyStatus(provider: string, hasSaved: boolean) {
  const inputRow = document.getElementById(`${provider}-input-row`);
  const savedRow = document.getElementById(`${provider}-saved-row`);

  if (inputRow && savedRow) {
    if (hasSaved) {
      inputRow.style.display = 'none';
      savedRow.style.display = 'block';
    } else {
      inputRow.style.display = 'flex';
      savedRow.style.display = 'none';
    }
  }
}

/**
 * Initial load of API key statuses
 */
export async function loadApiKeyStatuses() {
  try {
    const statuses = await window.settingsAPI.getApiKeys();
    ['gemini', 'anthropic', 'openai'].forEach((provider) => {
      const hasKey = statuses[`${provider}ApiKey`];
      updateApiKeyStatus(provider, hasKey);
    });
  } catch (e: unknown) {
    console.error('Failed to load API key statuses:', e);
  }
}
