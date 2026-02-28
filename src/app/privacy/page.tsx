export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: April 4, 2026</p>
      <div className="mt-6 space-y-4 text-sm text-foreground">
        <p>
          This Privacy Policy describes how indieFilmer (&quot;we&quot;,
          &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your
          personal information when you use the indieFilmer service
          (&quot;Service&quot;). By using the Service, you agree to the
          collection and use of information in accordance with this policy.
        </p>

        <p>
          <strong>1. Information We Collect</strong>
        </p>
        <p>We collect the following categories of information:</p>
        <ul className="ml-4 list-disc space-y-1 pl-2">
          <li>
            <strong>Account information:</strong> When you create an account, we
            collect your email address and, optionally, your name. We use
            email-based sign-in codes — no password is stored.
          </li>
          <li>
            <strong>Project and production data:</strong> All content you create
            within the Service, including projects, scenes, cast and crew
            records, schedules, call sheets, budgets, locations, notes, scripts,
            shot lists, gear lists, craft services information, contacts, tasks,
            and any other production-related materials.
          </li>
          <li>
            <strong>Usage data:</strong> Basic server logs such as IP addresses,
            browser type, and request timestamps necessary for operating and
            securing the Service. We do not use third-party analytics or
            tracking services.
          </li>
        </ul>

        <p>
          <strong>2. How We Use Your Information</strong>
        </p>
        <p>We use the information we collect to:</p>
        <ul className="ml-4 list-disc space-y-1 pl-2">
          <li>Provide, operate, and maintain the Service.</li>
          <li>Authenticate your identity and manage your account.</li>
          <li>
            Send transactional emails such as sign-in codes and account-related
            notifications.
          </li>
          <li>Respond to your requests, questions, and support inquiries.</li>
          <li>
            Detect, prevent, and address technical issues and security threats.
          </li>
          <li>
            Comply with legal obligations and enforce our Terms of Service.
          </li>
        </ul>
        <p>
          We do not sell, rent, or share your personal information with third
          parties for marketing purposes.
        </p>

        <p>
          <strong>3. Data Storage and Security</strong>
        </p>
        <p>
          We take reasonable technical and organizational measures to protect
          your data. Specifically:
        </p>
        <ul className="ml-4 list-disc space-y-1 pl-2">
          <li>
            We use passwordless email-based sign-in. No passwords are stored.
          </li>
          <li>
            All data transmitted between your browser and our servers is
            encrypted in transit using TLS (HTTPS).
          </li>
          <li>
            Production data is stored in a database with access restricted to
            authorized services only.
          </li>
          <li>
            Backups are handled according to our infrastructure provider&apos;s
            practices and our own backup mechanisms within the Service.
          </li>
        </ul>
        <p>
          While we strive to protect your information, no method of
          transmission over the internet or electronic storage is completely
          secure. We cannot guarantee absolute security.
        </p>

        <p>
          <strong>4. Third-Party Services</strong>
        </p>
        <p>
          The hosted version of the Service uses the following third-party
          services:
        </p>
        <ul className="ml-4 list-disc space-y-1 pl-2">
          <li>
            <strong>Resend:</strong> Used to send transactional emails such as
            sign-in verification codes. Your email address is shared with Resend
            solely for this purpose. See{" "}
            <a
              href="https://resend.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              Resend&apos;s Privacy Policy
            </a>{" "}
            for details.
          </li>
          <li>
            <strong>Google Maps Platform (optional):</strong> If map features
            are enabled, location searches and address autocomplete queries are
            sent to Google&apos;s APIs. This may include the text you type when
            searching for locations. See{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              Google&apos;s Privacy Policy
            </a>{" "}
            for details.
          </li>
        </ul>
        <p>
          We do not currently use any third-party analytics, advertising, or
          tracking services. If this changes in the future, we will update this
          policy accordingly.
        </p>

        <p>
          <strong>5. Self-Hosted Deployments</strong>
        </p>
        <p>
          If you run a self-hosted instance of indieFilmer, your data remains
          entirely on your own infrastructure. We do not collect, access, or
          process any data from self-hosted installations. You are solely
          responsible for the security and privacy of data on your self-hosted
          instance.
        </p>

        <p>
          <strong>6. Data Retention and Deletion</strong>
        </p>
        <p>
          We retain your data for as long as your account is active or as needed
          to provide the Service. If you delete your account, we will delete
          your personal information and production data within a reasonable
          timeframe, except where we are required to retain certain information
          by law or for legitimate business purposes (such as resolving
          disputes or enforcing our Terms). You may request deletion of your
          account and data at any time by contacting us.
        </p>

        <p>
          <strong>7. Your Rights Under GDPR and Applicable Law</strong>
        </p>
        <p>
          If you are located in the European Economic Area (EEA), the United
          Kingdom, or another jurisdiction with applicable data protection laws,
          you have the following rights regarding your personal data:
        </p>
        <ul className="ml-4 list-disc space-y-1 pl-2">
          <li>
            <strong>Right of access:</strong> You may request a copy of the
            personal data we hold about you.
          </li>
          <li>
            <strong>Right to rectification:</strong> You may request that we
            correct inaccurate or incomplete personal data.
          </li>
          <li>
            <strong>Right to erasure:</strong> You may request that we delete
            your personal data, subject to legal obligations requiring
            retention.
          </li>
          <li>
            <strong>Right to data portability:</strong> You may request a copy
            of your data in a structured, commonly used, machine-readable
            format. The Service also provides built-in data export and backup
            features.
          </li>
          <li>
            <strong>Right to restrict processing:</strong> You may request that
            we limit how we process your personal data in certain
            circumstances.
          </li>
          <li>
            <strong>Right to object:</strong> You may object to the processing
            of your personal data in certain circumstances.
          </li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at the email
          address below. We will respond to your request within 30 days.
        </p>

        <p>
          <strong>8. Cookies</strong>
        </p>
        <p>
          The Service uses session cookies that are strictly necessary for
          authentication and the functioning of the application. These cookies
          are used to maintain your logged-in session and do not track your
          activity across other websites. We do not use advertising cookies,
          analytics cookies, or any other non-essential cookies.
        </p>

        <p>
          <strong>9. Children&apos;s Privacy</strong>
        </p>
        <p>
          The Service is not intended for use by children under the age of 13.
          We do not knowingly collect personal information from children under
          13. If we become aware that we have collected personal data from a
          child under 13, we will take steps to delete that information
          promptly. If you believe a child under 13 has provided us with
          personal data, please contact us immediately.
        </p>

        <p>
          <strong>10. Changes to This Policy</strong>
        </p>
        <p>
          We may update this Privacy Policy from time to time. When we make
          material changes, we will update the &quot;Last updated&quot; date at
          the top of this page and, where practical, notify you via email or
          through the Service. Your continued use of the Service after such
          changes constitutes your acceptance of the updated policy. We
          encourage you to review this page periodically.
        </p>

        <p>
          <strong>11. Contact</strong>
        </p>
        <p>
          If you have any questions about this Privacy Policy or wish to
          exercise your data protection rights, please contact us at{" "}
          <a
            href="mailto:josh@indiefilmer.win"
            className="text-primary underline hover:no-underline"
          >
            josh@indiefilmer.win
          </a>
          .
        </p>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        <a href="/login" className="text-primary underline hover:no-underline">
          Back to login
        </a>
      </p>
    </div>
  );
}
