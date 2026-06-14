// Helper per il bucket Storage PRIVATO dei documenti del professionista.
// L'app accede col service_role; il bucket non è pubblico: upload e download
// passano per URL firmati a breve scadenza, mai per URL pubblici.
import supabase from './db';

export const PRO_DOCS_BUCKET = 'pro-documents';

// URL firmato monouso per l'UPLOAD diretto browser → Storage (bypassa il limite
// di body delle funzioni serverless). Ritorna { signedUrl, token, path }.
export async function createUploadUrl(path) {
  const { data, error } = await supabase.storage.from(PRO_DOCS_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

// URL firmato a breve scadenza per il DOWNLOAD (default 60s). Bucket resta privato.
export async function createDownloadUrl(path, expiresIn = 60) {
  const { data, error } = await supabase.storage.from(PRO_DOCS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// Rimuove un file dal bucket (re-upload/cancellazione → niente file orfani).
export async function removeFile(path) {
  if (!path) return;
  await supabase.storage.from(PRO_DOCS_BUCKET).remove([path]).then(() => {}, () => {});
}
