type SaveState = { error?: string; success?: boolean };

// A lost response does not tell us whether the server committed the save.
// Keep the form mounted and never replay a mutation automatically.
export function recoverableSave(
  action: (state: SaveState, form: FormData) => Promise<SaveState>,
) {
  return async (state: SaveState, form: FormData): Promise<SaveState> => {
    try {
      return await action(state, form);
    } catch (error) {
      const digest =
        error && typeof error === "object" && "digest" in error
          ? String(error.digest)
          : "";
      // Let Next handle session redirects and route access responses.
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
      )
        throw error;
      return {
        error:
          "L’enregistrement n’a pas pu être confirmé. Vos saisies sont conservées. Vérifiez votre connexion et l’état enregistré avant de réessayer.",
      };
    }
  };
}
