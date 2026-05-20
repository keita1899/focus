import { redirect } from "next/navigation";

import { GoogleSignInButton } from "../../components/AuthControls";
import { auth } from "../../auth";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="loginPage">
      <section className="loginCard" aria-label="ログイン">
        <p>Focus Planner</p>
        <h1>Googleでログイン</h1>
        <GoogleSignInButton className="loginButton" />
      </section>
    </main>
  );
}
