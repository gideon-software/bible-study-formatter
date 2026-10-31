import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = {
  title: "Terms of Service | Bible Study Formatter",
  description: "Terms of Service for Bible Study Formatter provided by Gideon Software Solutions.",
};

export default function TermsOfServicePage() {
  return (
    <div className="container legal-page-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <FileText size={24} />
          </div>
          <div>
            <h1>Terms of Service</h1>
            <p>Bible Study Formatter • Gideon Software Solutions</p>
          </div>
        </div>

        <div className="header-actions">
          <ThemeToggle />
          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to Formatter
          </Link>
        </div>
      </header>

      <main className="glass-panel legal-content">
        <p className="legal-effective-date">
          <strong>Last Updated:</strong> October 31, 2026
        </p>

        <section>
          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using Bible Study Formatter (&quot;BSF&quot;, &quot;the Service&quot;), provided by Gideon
            Software Solutions (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of the Service</h2>
          <p>
            Bible Study Formatter is a web application that formats Scripture passages into styled
            Google Docs with customizable margins, typography, chapter headings, and poetic
            indentation, saved directly to the user&apos;s authorized Google Drive account.
          </p>
        </section>

        <section>
          <h2>3. User Accounts and Google Authorization</h2>
          <p>
            To generate Google Docs through BSF, you must sign in with a valid Google account and
            grant permission for BSF to create and format files in your Google Drive.
          </p>
          <ul>
            <li>
              You are responsible for maintaining the confidentiality and security of your Google
              account credentials.
            </li>
            <li>
              You agree to grant BSF permissions under the <code>drive.file</code> and{" "}
              <code>documents</code> scopes solely for creating, styling, and managing documents
              generated through the Service.
            </li>
            <li>
              You may revoke BSF&apos;s access at any time via your Google Account Security Settings.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Scripture Copyrights and Publisher Guidelines</h2>
          <p>
            Scripture text formatted through BSF remains the copyrighted property of its respective
            publishers and copyright holders:
          </p>
          <ul>
            <li>
              <strong>English Standard Version (ESV):</strong> The Holy Bible, English Standard
              Version. ESV® Text Edition: 2016. Copyright © 2001 by Crossway, a publishing ministry of
              Good News Publishers. Used by permission. All rights reserved. Users agree to comply
              with Crossway&apos;s fair-use guidelines (maximum 500 verses per export).
            </li>
            <li>
              <strong>Christian Standard Bible (CSB):</strong> Copyright © 2017 by Holman Bible
              Publishers. All rights reserved.
            </li>
            <li>
              <strong>New International Version (NIV):</strong> THE HOLY BIBLE, NEW INTERNATIONAL
              VERSION®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by
              permission. All rights reserved worldwide.
            </li>
            <li>
              <strong>New American Standard Bible (NASB):</strong> New American Standard Bible®,
              Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. All rights
              reserved.
            </li>
            <li>
              <strong>NET Bible:</strong> Scripture quoted by permission. Quotations designated (NET)
              are from the NET Bible® copyright ©1996-2016 by Biblical Studies Press, L.L.C. All rights
              reserved.
            </li>
          </ul>
          <p>
            You are responsible for ensuring that your personal, study, teaching, or ministry use of
            generated documents complies with the respective publishers&apos; fair use policies and
            copyright conditions.
          </p>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful or abusive purpose.</li>
            <li>Attempt to bypass rate limits, quotas, or automated access controls.</li>
            <li>Disrupt or compromise the stability, integrity, or performance of the Service.</li>
            <li>Misrepresent your identity or unauthorizedly impersonate another user.</li>
          </ul>
        </section>

        <section>
          <h2>6. Disclaimer of Warranties</h2>
          <p>
            The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any
            kind, whether express or implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement. We do not
            guarantee that the Service will always be uninterrupted, error-free, or completely secure.
          </p>
        </section>

        <section>
          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Gideon Software Solutions shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages, or any
            loss of data, files, or profits arising out of or related to your use of or inability to
            use the Service.
          </p>
        </section>

        <section>
          <h2>8. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. When changes are made, the &quot;Last
            Updated&quot; date at the top of this page will be revised. Your continued use of the Service
            after any such changes constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2>9. Contact Information</h2>
          <p>For questions or notices regarding these Terms of Service, please contact:</p>
          <div className="legal-contact-card">
            <strong>Gideon Software Solutions</strong>
            <br />
            Email:{" "}
            <a href="mailto:gideonsoftwaresolutions@gmail.com">
              gideonsoftwaresolutions@gmail.com
            </a>
            <br />
            Website:{" "}
            <a
              href="https://www.gideonsoftware.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.gideonsoftware.com
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

