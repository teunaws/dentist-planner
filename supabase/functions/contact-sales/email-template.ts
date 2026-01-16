// Email Template Generator for Contact Sales
// Matches the style of confirmation/reminder emails

interface ContactEmailProps {
  name: string
  email: string
  phone: string
  practiceName: string
  message: string
}

export function generateContactHTML(props: ContactEmailProps): string {
  const { name, email, phone, practiceName, message } = props

  // Escape HTML and convert line breaks
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  // Generate HTML email with inline CSS (matching confirmation email style)
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Lead: ${practiceName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; line-height: 32px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                New Lead: ${practiceName}
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 500; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Contact Form Submission
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <!-- Lead Information Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #e2e8f0;">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <!-- Name -->
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Name
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            ${name}
                          </div>
                        </td>
                      </tr>
                      <!-- Email -->
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Email
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <a href="mailto:${email}" style="color: #0f172a; text-decoration: none;">${email}</a>
                          </div>
                        </td>
                      </tr>
                      <!-- Phone -->
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Phone
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <a href="tel:${phone.replace(/[^0-9+]/g, '')}" style="color: #0f172a; text-decoration: none;">${phone}</a>
                          </div>
                        </td>
                      </tr>
                      <!-- Practice Name -->
                      <tr>
                        <td>
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Practice Name
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            ${practiceName}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Message Section -->
              <div style="color: #334155; line-height: 1.6; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                  Message
                </div>
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-top: 8px;">
                  <p style="margin: 0; white-space: pre-wrap; color: #334155; font-size: 16px; line-height: 1.6;">
                    ${escapedMessage}
                  </p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <p style="margin: 0 0 8px 0;">
                This lead was submitted through the contact form on the homepage.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Powered by Dentist Appointment Planner
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return html
}





