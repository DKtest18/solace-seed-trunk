-- ============================================================
-- DSGVO/nDSG-konforme Legal Pages für DK AI Marketplace
-- Ausführen im Supabase SQL Editor (Dashboard > SQL Editor)
-- Stand: 2026-03-08
-- ============================================================

-- Tabelle erstellen (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE legal_pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'legal_pages' AND policyname = 'Anyone can read legal pages'
  ) THEN
    CREATE POLICY "Anyone can read legal pages" ON legal_pages FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- 1. IMPRESSUM
INSERT INTO legal_pages (page_type, title, content)
VALUES ('imprint', 'Legal Notice / Impressum',
'Legal Notice (Impressum)

Company Information:
DK AI Marketplace
Dari Kastrati (Einzelunternehmen)
Udligenswilerstrasse 15
6043 Adligenswil
Switzerland

Owner / Responsible Person:
Dari Kastrati

Contact:
Email: support@dkaimarketplace.com

VAT Identification Number:
Not yet registered (in application)

Trade Register:
Not registered (Einzelunternehmen / sole proprietorship)

Responsible for content:
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Switzerland

EU Online Dispute Resolution:
The European Commission provides a platform for online dispute resolution (ODR):
https://ec.europa.eu/consumers/odr/
We are not obligated and not willing to participate in dispute resolution proceedings before a consumer arbitration board.

Liability for Content:
As a service provider, we are responsible for our own content on these pages. However, we are not obligated to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity. Obligations to remove or block the use of information under general law remain unaffected.

Liability for Links:
Our offer contains links to external third-party websites, the content of which we have no influence over. Therefore, we cannot assume any liability for this external content. The respective provider or operator is always responsible for the content of the linked pages.

Copyright:
The content and works on these pages created by the site operator are subject to Swiss and international copyright law. Reproduction, editing, distribution, and any kind of use beyond the limits of copyright require the written consent of the respective author or creator.')
ON CONFLICT (page_type) DO UPDATE SET 
  title = EXCLUDED.title, 
  content = EXCLUDED.content,
  last_updated = now();

-- 2. DATENSCHUTZERKLAERUNG (Privacy Policy)
INSERT INTO legal_pages (page_type, title, content)
VALUES ('privacy', 'Privacy Policy / Datenschutzerklaerung',
'Privacy Policy (Datenschutzerklaerung)
Last updated: 2026-03-08

This privacy policy applies in accordance with the EU General Data Protection Regulation (GDPR), the Swiss Federal Act on Data Protection (nDSG/FADP), and other applicable data protection laws.

1. Data Controller (Verantwortlicher)
DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Switzerland
Email: support@dkaimarketplace.com

2. Data Protection Contact
For data protection inquiries:
Email: privacy@dkaimarketplace.com

3. Overview of Data Processing
We process personal data only to the extent necessary for the provision of a functional website and our content and services. The processing of personal data takes place only with your consent or where processing is permitted by law.

4. Legal Basis for Processing (Art. 6 GDPR)
- Art. 6(1)(a) GDPR: Consent (e.g., newsletter, cookies)
- Art. 6(1)(b) GDPR: Contract performance (e.g., purchase processing, account management)
- Art. 6(1)(c) GDPR: Legal obligation (e.g., tax records, fraud prevention)
- Art. 6(1)(f) GDPR: Legitimate interests (e.g., platform security, analytics)

5. Data We Collect
a) Account Data: Email address, username, display name, profile picture, password (hashed)
b) Transaction Data: Purchase history, payment information (processed by Stripe), order details, dispute records
c) Communication Data: Messages between users, support requests, meeting data
d) Technical Data: IP address, browser type, device information, access times (server logs)
e) Usage Data: Pages visited, features used, search queries (anonymized analytics)

6. Third-Party Service Providers (Auftragsverarbeiter)

a) Supabase Inc.
- Purpose: Database hosting, authentication, file storage
- Data: All account and application data
- Location: EU/US (with Standard Contractual Clauses)
- Privacy: https://supabase.com/privacy

b) Stripe Inc.
- Purpose: Payment processing, escrow management, seller payouts (Stripe Connect)
- Data: Payment details, transaction amounts, bank account info (sellers)
- Location: US (with Standard Contractual Clauses, certified under EU-US Data Privacy Framework)
- Privacy: https://stripe.com/privacy

c) Resend Inc.
- Purpose: Transactional email delivery
- Data: Email addresses, email content
- Location: US (with Standard Contractual Clauses)
- Privacy: https://resend.com/legal/privacy-policy

d) Anthropic PBC
- Purpose: AI assistant functionality
- Data: User queries to AI assistant (no personal data stored)
- Location: US
- Privacy: https://www.anthropic.com/privacy

e) Lovable (GPT Engineer AB)
- Purpose: Application hosting and deployment
- Location: EU (Sweden)
- Privacy: https://lovable.dev/privacy

7. Cookies and Tracking
We use the following types of cookies:
- Essential Cookies: Required for platform functionality (authentication, session management)
- Preference Cookies: Store your settings (theme, language)
We do NOT use tracking cookies or third-party advertising cookies.
You can manage cookie preferences through the cookie consent banner or your browser settings.

8. Data Retention
- Account data: Retained until account deletion
- Transaction records: 10 years (Swiss OR Art. 958f / EU tax law obligations)
- Server logs: 30 days
- Messages: Until account deletion or manual deletion by user
- Anonymized analytics: Indefinitely

9. Your Rights (Betroffenenrechte)
Under GDPR and nDSG, you have the following rights:
a) Right of Access (Art. 15 GDPR / Art. 25 nDSG): You can request information about your stored personal data
b) Right to Rectification (Art. 16 GDPR / Art. 32 nDSG): You can request correction of inaccurate data
c) Right to Erasure (Art. 17 GDPR): You can request deletion of your data (right to be forgotten). Use Settings > Data and Account > Delete Account
d) Right to Restriction (Art. 18 GDPR): You can request restriction of processing
e) Right to Data Portability (Art. 20 GDPR / Art. 28 nDSG): You can export your data in machine-readable format (JSON). Use Settings > Data and Account > Export Data
f) Right to Object (Art. 21 GDPR): You can object to processing based on legitimate interests
g) Right to Withdraw Consent (Art. 7(3) GDPR): You can withdraw consent at any time

To exercise these rights, contact: support@dkaimarketplace.com

10. Right to Lodge a Complaint
You have the right to lodge a complaint with a supervisory authority:
- Switzerland: Eidgenoessischer Datenschutz- und Oeffentlichkeitsbeauftragter (EDOEB), Feldeggweg 1, 3003 Bern, https://www.edoeb.admin.ch
- EU: The supervisory authority in your country of habitual residence

11. Data Transfer to Third Countries
Some of our service providers are based in the USA. Data transfers are secured by:
- EU-US Data Privacy Framework (where applicable)
- Standard Contractual Clauses (Art. 46(2)(c) GDPR)
- Swiss-US Data Privacy Framework
- Additional technical and organizational safeguards (encryption in transit and at rest)

12. Automated Decision-Making
We use automated content moderation to detect prohibited content. This does not produce legal effects on users. Disputes are always reviewed by a human administrator.

13. Data Security
We implement appropriate technical and organizational measures:
- AES-256-GCM encryption for sensitive data
- TLS/SSL encryption for all data in transit
- Two-factor authentication (TOTP) available
- Regular security reviews
- Row-Level Security (RLS) on all database tables
- Input sanitization (DOMPurify) against XSS attacks

14. Children
Our platform is not directed at persons under 16 years of age. We do not knowingly collect data from minors.

15. Changes to This Policy
We reserve the right to update this privacy policy. Users will be notified of significant changes via email or platform notification.')
ON CONFLICT (page_type) DO UPDATE SET 
  title = EXCLUDED.title, 
  content = EXCLUDED.content,
  last_updated = now();

-- 3. AGB (Terms of Service)
INSERT INTO legal_pages (page_type, title, content)
VALUES ('terms', 'Terms of Service / Allgemeine Geschaeftsbedingungen',
'Terms of Service (Allgemeine Geschaeftsbedingungen)
Last updated: 2026-03-08

1. Scope and Provider
These Terms of Service govern the use of DK AI Marketplace ("Platform"), operated by:
Dari Kastrati (Einzelunternehmen)
Udligenswilerstrasse 15
6043 Adligenswil, Switzerland
Email: support@dkaimarketplace.com

The Platform is a marketplace for digital products, AI agents, and digital services.

2. Registration and Account
2.1 You must be at least 16 years old to create an account.
2.2 You are responsible for maintaining the confidentiality of your account credentials.
2.3 You must provide accurate and complete information during registration.
2.4 We reserve the right to suspend or terminate accounts that violate these terms.

3. Buyer Terms
3.1 Payment and Escrow
- All payments are processed through Stripe
- Payments are held in escrow until the return window expires
- After the return window, 90% is released to the seller and 10% is retained as platform fee
- Buyers receive a 100% refund if they return within the valid return window

3.2 Return Window
- Each product has a return window set by the seller (minimum 24 hours, maximum 90 days)
- The mandatory minimum return period is 24 hours, regardless of seller settings
- If no action is taken before the return window expires, payment is automatically released to the seller

3.3 EU Right of Withdrawal (Widerrufsrecht)
- Under EU Directive 2011/83/EU, consumers have a 14-day right of withdrawal for distance contracts
- For digital content: This right may be waived at checkout if you expressly consent to immediate delivery and acknowledge the loss of your withdrawal right (Art. 16(m) EU Directive 2011/83/EU)
- The waiver checkbox is mandatory at checkout for digital goods
- If you do not waive the withdrawal right, delivery will begin after the 14-day period

3.4 Disputes
- Buyers may open disputes for products that do not match their description
- Evidence (screenshots, logs) must be provided when claiming defects
- Abuse of the dispute system may result in account suspension
- All disputes are reviewed by platform administrators

3.5 Reminder Communications
- Sellers may send up to 3 reminders (in-app + email) requesting receipt confirmation and review
- By purchasing, you consent to receiving these order-related communications

4. Seller Terms
4.1 Eligibility
- Sellers must complete identity verification and accept seller-specific terms
- Sellers must connect a valid Stripe Connect account for payouts
- Two-factor authentication (2FA) is required for seller accounts

4.2 Products
- Products must accurately match their listing description
- No malware, illegal content, or copyrighted material without authorization
- Sellers must provide functional delivery files for purchased products
- Products are subject to content moderation

4.3 Payouts and Fees
- Platform fee: 10% of each sale
- Seller receives: 90% via Stripe Connect
- Payouts are only processed after the return window has fully expired
- Sellers must plan ahead as no early payouts are available

4.4 Obligations
- Sellers must deliver purchased products promptly
- Sellers must respond to buyer inquiries and disputes in a timely manner
- Sellers must comply with all applicable laws regarding digital product sales

5. Prohibited Content and Conduct
5.1 Users may not:
- Upload malicious software or content designed to harm others
- Engage in fraud, impersonation, or deceptive practices
- Harass, threaten, or abuse other users
- Attempt to circumvent platform security measures
- Create multiple accounts to evade bans or restrictions
- Manipulate ratings or reviews

5.2 Content Moderation
- All content is subject to automated and manual moderation
- Violations may result in content removal, account suspension, or permanent ban

6. Intellectual Property
6.1 Sellers retain ownership of their digital products
6.2 By listing a product, sellers grant the Platform a license to display and distribute the product listing
6.3 Buyers receive a license to use purchased products as specified in the product listing
6.4 The Platform''s own content, branding, and code are protected by copyright

7. Limitation of Liability
7.1 The Platform acts as an intermediary between buyers and sellers
7.2 We are not responsible for the quality, legality, or accuracy of products listed by sellers
7.3 Our liability is limited to the amount of platform fees collected
7.4 We are not liable for indirect, incidental, or consequential damages
7.5 These limitations do not apply where mandatory law (e.g., EU consumer protection) provides otherwise

8. Dispute Resolution
8.1 Users should first attempt to resolve disputes directly
8.2 The Platform provides a dispute resolution system for transaction-related issues
8.3 Platform administrators make final decisions on disputes
8.4 For unresolved issues, the competent courts in Luzern, Switzerland shall have jurisdiction, unless mandatory consumer protection law dictates otherwise
8.5 EU Online Dispute Resolution: https://ec.europa.eu/consumers/odr/

9. Data Protection
Personal data is processed in accordance with our Privacy Policy and applicable data protection laws (GDPR/nDSG). See our Privacy Policy for details.

10. Amendments
10.1 We reserve the right to modify these terms
10.2 Users will be notified of material changes via email or platform notification at least 30 days before they take effect
10.3 Continued use after the effective date constitutes acceptance
10.4 If you do not agree with the changes, you may terminate your account

11. Severability (Salvatorische Klausel)
If any provision of these terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect. The invalid provision shall be replaced by a valid provision that most closely reflects the economic intent.

12. Applicable Law
These terms are governed by the laws of Switzerland, excluding the UN Convention on Contracts for the International Sale of Goods (CISG). For EU consumers, mandatory consumer protection provisions of the country of the consumer''s habitual residence remain unaffected (Art. 6(2) Rome I Regulation).')
ON CONFLICT (page_type) DO UPDATE SET 
  title = EXCLUDED.title, 
  content = EXCLUDED.content,
  last_updated = now();

-- 4. COOKIE POLICY
INSERT INTO legal_pages (page_type, title, content)
VALUES ('cookies', 'Cookie Policy',
'Cookie Policy
Last updated: 2026-03-08

1. What Are Cookies?
Cookies are small text files stored on your device when you visit a website. They help the website function properly and improve your experience.

2. Cookies We Use

a) Strictly Necessary Cookies (no consent required)
- Authentication cookies (Supabase session token)
- CSRF protection tokens
- Cookie consent preference
These are essential for the Platform to function and cannot be disabled.

b) Preference Cookies (with consent)
- Theme preference (light/dark mode)
- Language preference
- Sidebar layout preference

3. Cookies We Do NOT Use
- Advertising or marketing cookies
- Third-party tracking cookies
- Social media tracking pixels
- Google Analytics or similar tracking services

4. Third-Party Cookies
- Stripe: May set cookies for payment processing and fraud prevention (see Stripe''s Cookie Policy: https://stripe.com/cookies-policy/legal)

5. Managing Cookies
You can manage cookies through:
- Our cookie consent banner (shown on first visit)
- Your browser settings (instructions vary by browser)
- Settings > Appearance in your account

6. Impact of Disabling Cookies
Disabling strictly necessary cookies will prevent you from using the Platform (login, purchasing, etc.).

7. Changes
We may update this Cookie Policy. Changes will be reflected in the Last updated date above.

8. Contact
For questions about our cookie practices: support@dkaimarketplace.com')
ON CONFLICT (page_type) DO UPDATE SET 
  title = EXCLUDED.title, 
  content = EXCLUDED.content,
  last_updated = now();

-- 5. REFUND POLICY (Widerrufsbelehrung)
INSERT INTO legal_pages (page_type, title, content)
VALUES ('refund', 'Refund and Return Policy / Widerrufsbelehrung',
'Refund and Return Policy (Widerrufsbelehrung)
Last updated: 2026-03-08

1. EU Right of Withdrawal (Widerrufsrecht)

1.1 Withdrawal Right for Consumers
If you are a consumer (Verbraucher) within the EU, you have the right to withdraw from a distance contract within 14 days without giving any reason, pursuant to EU Directive 2011/83/EU.

1.2 Withdrawal Period
The withdrawal period expires 14 days after the day of the conclusion of the contract.

1.3 Exercising the Withdrawal Right
To exercise your right of withdrawal, you must inform us of your decision by a clear statement:

DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Switzerland
Email: support@dkaimarketplace.com

You may use the following model withdrawal form (but it is not obligatory):

--- Model Withdrawal Form ---
To: DK AI Marketplace, Dari Kastrati, Udligenswilerstrasse 15, 6043 Adligenswil, Switzerland
Email: support@dkaimarketplace.com

I hereby give notice that I withdraw from my contract of sale of the following digital product:
- Product name: ___
- Order number: ___
- Ordered on: ___
- Consumer name: ___
- Consumer email: ___
- Date: ___
- Signature (only if sent by post): ___
--- End of Form ---

1.4 Waiver for Digital Content
For digital content (software, AI agents, digital downloads, etc.), the right of withdrawal may be lost prematurely if:
- You expressly consented to the beginning of delivery before the withdrawal period expired, AND
- You acknowledged that you thereby lose your right of withdrawal
This waiver is presented as a mandatory checkbox at checkout (Art. 16(m) EU Directive 2011/83/EU).

1.5 Effects of Withdrawal
If you withdraw, we shall reimburse all payments received from you without undue delay and no later than 14 days from the day we are informed of your decision. The reimbursement will be made using the same means of payment as the original transaction.

2. Platform Return Window

2.1 In addition to the EU withdrawal right, every product on DK AI Marketplace has a return window set by the seller:
- Minimum: 24 hours
- Maximum: 90 days

2.2 Within this return window, you may return the product and receive a 100% refund to your original payment method, regardless of reason.

2.3 If you take no action (no confirmation, no dispute, no return) before the return window expires, payment is automatically released to the seller.

3. Refund Process
3.1 Returns within the return window: 100% refund to original payment method via Stripe
3.2 Disputed products: Reviewed by platform administrators. If the dispute is upheld, a full refund is issued to your platform balance or original payment method.
3.3 Refund timeline: Refunds are processed within 5-10 business days depending on your payment provider.

4. When Refunds Are NOT Available
- After the return window has expired AND the EU withdrawal right has been waived
- If the product has been found to be used in violation of our Terms of Service
- If a dispute is found to be fraudulent

5. Seller Obligations
- Sellers cannot refuse a valid return within the return window
- Sellers must deliver products that match their listing description
- If a product does not match the description, the buyer has a mandatory right to a full refund regardless of the return window

6. Contact
For refund requests or questions:
DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Switzerland
Email: support@dkaimarketplace.com

7. Applicable Law
This refund policy is governed by EU Directive 2011/83/EU and the laws of Switzerland. Mandatory consumer protection provisions of the consumer''s country of habitual residence remain unaffected.')
ON CONFLICT (page_type) DO UPDATE SET 
  title = EXCLUDED.title, 
  content = EXCLUDED.content,
  last_updated = now();
