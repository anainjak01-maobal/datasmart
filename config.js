/* ============================================================
   DataSmart · Configuración del sitio
   Único archivo que se edita para conectar el sitio con la hoja de Google.
   ============================================================ */
window.DS_CONFIG = {
  NEGOCIO: "Peluquería Meylin · Maicao",

  /* Enlaces CSV de las hojas publicadas (Archivo > Compartir > Publicar en la web > CSV).
     Publica SOLO las hojas Servicios y Agenda. La hoja Agenda que se publica no debe tener nombres de clientas. */
  HOJAS: {
    servicios: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXaWGxfXQ7LxKnErJvYiIR25yRmjwUcHL8hON2Xe8fjQbhb5nZ-QMdrWOrye2X6cpqbtczj08n3JCp/pub?gid=1260693872&single=true&output=csv",
    agenda: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSXaWGxfXQ7LxKnErJvYiIR25yRmjwUcHL8hON2Xe8fjQbhb5nZ-QMdrWOrye2X6cpqbtczj08n3JCp/pub?gid=2016744713&single=true&output=csv"
  },

  /* Registro automático: dirección de la aplicación web de Apps Script (ver LEEME.txt, paso 4).
     Si queda vacío, la página de registro muestra el modo de demostración y no guarda nada. */
  REGISTRO: "https://script.google.com/macros/s/AKfycbw2MFnn32mrVFpe2sd_fcllng0yZ1cf0vvEaG1KjvnFp0mQ6RNUnCS-P8VAb82sFOZdoA/exec"
};
