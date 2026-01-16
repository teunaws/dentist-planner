// Email Template Generator
// Pure function - no side effects, no database calls, no imports
// Accepts strings and returns HTML string

interface EmailProps {
  tenantName: string
  patientName: string
  date: string
  time: string
  service: string
  bodyText: string
  manageLink?: string
}

export function generateHTML(props: EmailProps): string {
  const {
    tenantName,
    patientName,
    date,
    time,
    service,
    bodyText,
    manageLink,
  } = props

  // Convert body text to HTML (preserve line breaks, escape HTML)
  const bodyHtml = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  // Generate HTML email with inline CSS (required for email clients)
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Appointment Confirmation</title>
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
                Appointment Confirmed
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 500; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                ${tenantName}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <!-- Custom Body Text -->
              <div style="color: #334155; line-height: 1.6; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                ${bodyHtml}
              </div>
              
              <!-- Appointment Info Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #e2e8f0;">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <!-- Date -->
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Date
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            ${date}
                          </div>
                        </td>
                      </tr>
                      <!-- Time -->
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Time
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            ${time}
                          </div>
                        </td>
                      </tr>
                      <!-- Service -->
                      <tr>
                        <td>
                          <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            Service
                          </div>
                          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            ${service}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Call-to-Action Button (if manageLink provided) -->
              ${manageLink ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <a href="${manageLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      Manage Appointment
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <p style="margin: 0 0 8px 0;">
                This is an automated confirmation email. Please do not reply to this message.
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

