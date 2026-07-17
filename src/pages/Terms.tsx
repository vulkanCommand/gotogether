import LegalLayout from "@/components/site/LegalLayout";

const EMAIL = "gdkalyan2109@gmail.com";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The rules for using GoTogether responsibly."
      path="/terms"
      lastUpdated="May 2026"
    >
      <p>
        By using GoTogether, you agree to use the app responsibly and only for lawful personal trip
        planning, friend coordination, itinerary management, live trip updates, and shared expense
        tracking.
      </p>

      <h2>Your responsibility</h2>
      <p>
        You are responsible for the accuracy of the information you add to the app, including your
        profile details, trip details, itinerary events, locations, expenses, and shared content.
        GoTogether is designed to help organize group travel, but users are responsible for making
        safe travel decisions, verifying locations, managing payments outside the app when needed,
        and confirming plans with their group.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Misuse the app or upload harmful or inappropriate content</li>
        <li>Harass other users</li>
        <li>Attempt unauthorized access or interfere with app functionality</li>
        <li>Use the app for illegal activity</li>
      </ul>

      <h2>Permissions</h2>
      <p>
        Some features may require access to your contacts, photos, location, or notifications. You
        can manage those permissions in your device settings.
      </p>

      <h2>Shared trip visibility</h2>
      <p>Shared trip information may be visible to other members of the same trip.</p>

      <h2>Changes to the service</h2>
      <p>
        GoTogether may update, modify, suspend, or discontinue features as needed to improve the
        app, maintain security, or comply with legal requirements.
      </p>

      <h2>Account deletion</h2>
      <p>
        You can delete your account from the Settings screen in the app, and account deletion will
        be handled according to our Privacy Policy.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        GoTogether is provided as-is without guarantees that every feature will always be available,
        error-free, or uninterrupted. To the fullest extent allowed by law, GoTogether is not
        responsible for travel disruptions, user-created content, incorrect trip information,
        expense disagreements, location issues, or decisions made based on app content.
      </p>

      <h2>Contact</h2>
      <p>
        If you need support or have questions about these terms, contact us at{" "}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}