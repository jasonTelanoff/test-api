import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import * as fs from 'fs'
import * as path from 'path'
import * as jose from "jose";
import { fileURLToPath } from 'url';

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const jwtToken = body?.jwt;

    if (!jwtToken) {
      console.log('JWT not provided');
      console.log(body);
      return c.text('JWT not provided', 400);
    }

    // Fetch the public key
    const publicKeyResponse = await fetch('https://api.nerve.run/pubkey');
    if (!publicKeyResponse.ok) {
      console.log('Failed to fetch public key');
      return c.text('Failed to fetch public key', 500);
    }
    const certificate = await publicKeyResponse.text();

    // Convert the certificate to a CryptoKey
    const cryptoKey = await jose.importX509(certificate, 'RS384');

    // Verify the JWT
    let decodedData;
    try {
      const { payload } = await jose.jwtVerify(jwtToken, cryptoKey);
      decodedData = payload;
    } catch (err) {
      console.log('Invalid JWT:', err.message);
      return c.text('Invalid JWT', 401);
    }

    // Extract and log the data
    const {
      patient_name,
      mr_number,
      physician_name,
      visit_date,
      agent_name,
      visit_type,
      visitNotesPDF,
      medicalReportPDF,
    } = decodedData as {
      patient_name: string;
      mr_number: string;
      physician_name: string;
      visit_date: string;
      agent_name: string;
      visit_type: string;
      visitNotesPDF: string;
      medicalReportPDF: string;
    };

    console.log({
      patient_name,
      mr_number,
      physician_name,
      visit_date,
      agent_name,
      visit_type,
    });

    // Save the PDFs
    const __dirname = path.dirname(fileURLToPath(import.meta.url)); // Resolve __dirname
    const saveDirectory = path.resolve(__dirname, 'saved_pdfs');
    if (!fs.existsSync(saveDirectory)) {
      fs.mkdirSync(saveDirectory);
    }

    const visitNotesPath = path.join(
      saveDirectory,
      `${patient_name.replace(/\s+/g, '_')}_visitNotes.pdf`
    );
    const medicalReportPath = path.join(
      saveDirectory,
      `${patient_name.replace(/\s+/g, '_')}_medicalReport.pdf`
    );

    fs.writeFileSync(visitNotesPath, Buffer.from(visitNotesPDF, 'base64')); // Buffer is available after adding @types/node
    fs.writeFileSync(medicalReportPath, Buffer.from(medicalReportPDF, 'base64'));

    console.log('PDFs saved successfully');
    console.log('Operation completed successfully');

    return c.text('Data processed successfully', 200);
  } catch (error) {
    console.error('Error processing request:', error);
    return c.text('Internal Server Error', 500);
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
