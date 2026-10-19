/* ============================================================
   DataSmart · Configuración del sitio
   Único archivo que se edita para conectar el sitio con la hoja de Google.
   ============================================================ */
window.DS_CONFIG = {
  NEGOCIO: "Peluquería Meylin · Maicao",

  /* Ya no se usan enlaces CSV: el script lee las hojas con la clave del equipo.
     No publiques las hojas en la web (Archivo > Compartir > Publicar en la web). Puedes dejar estos enlaces vacíos. */
  HOJAS: {
    servicios: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXaWGxfXQ7LxKnErJvYiIR25yRmjwUcHL8hON2Xe8fjQbhb5nZ-QMdrWOrye2X6cpqbtczj08n3JCp/pub?gid=1260693872&single=true&output=csv",
    agenda: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXaWGxfXQ7LxKnErJvYiIR25yRmjwUcHL8hON2Xe8fjQbhb5nZ-QMdrWOrye2X6cpqbtczj08n3JCp/pub?gid=2016744713&single=true&output=csv"
  },

  /* WhatsApp del negocio para que la clienta envíe su reserva: indicativo + número, sin + ni espacios (ej. "573001234567"). */
  WHATSAPP: "573003304886",

  /* OBLIGATORIO: dirección de la aplicación web de Apps Script (termina en /exec, ver LEEME.txt, paso 3).
     Sin esto, ni el tablero ni el registro de citas abren. */
  REGISTRO: "https://script.google.com/macros/s/AKfycbzItrOhthkTJTgYKaDkolEeg8tBrZX-wHZn97ZuAMjyYZKzHzfMH6lDzKm2zpq07-Kx-A/exec"
};
