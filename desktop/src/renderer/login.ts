export function mountLogin(
  form: HTMLFormElement,
  message: HTMLElement,
  login: (password: string) => Promise<void>,
  onSuccess: () => void,
): void {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    const password = String(new FormData(form).get("password") ?? "");
    try {
      await login(password);
      onSuccess();
    } catch {
      message.textContent = "La contraseña no coincide.";
    }
  });
}
