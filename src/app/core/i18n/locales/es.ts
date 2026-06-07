// Flat dictionary. Keys are dot-paths grouped by domain.
// New strings always land here first; never inline a literal in a template.

export const es = {
  'app.name': 'mi cerebro',
  'app.tagline': 'tu segundo cerebro',
  'app.loading': 'Cargando...',

  'common.close': 'Cerrar',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.retry': 'Reintentar',
  'common.details': 'Ver detalles',
  'common.code': 'Código',
  'common.chooseFolder': 'Elegir carpeta',
  'common.chooseAnother': 'Elegir otra carpeta',
  'common.continue': 'Continuar',

  'onboarding.welcome.title': 'Bienvenido a mi cerebro',
  'onboarding.welcome.line1': 'Es tu segundo cerebro local: notas, tareas, objetivos y más.',
  'onboarding.welcome.line2':
    'Todo vive en una carpeta tuya. Nada va a la nube. Vos seguís siendo el dueño.',
  'onboarding.welcome.line3':
    'Elegí dónde guardarlo. Si la carpeta está vacía, te armo la estructura.',
  'onboarding.unsupported.title': 'Navegador no compatible',
  'onboarding.unsupported.message':
    'mi-cerebro usa una API que sólo está en Chrome, Edge, Vivaldi o Brave. Abrila desde uno de esos.',
  'onboarding.foreign.title': 'Esta carpeta tiene contenido',
  'onboarding.foreign.message':
    'Encontré archivos que no son de mi-cerebro. Puedo inicializar acá sin tocarlos, o elegir otra carpeta.',
  'onboarding.foreign.initHere': 'Inicializar acá',
  'onboarding.initializing': 'Preparando tu carpeta...',
  'onboarding.welcomeBack': 'Bienvenido de nuevo a {name}',

  'permission.banner.title': 'Permisos a la carpeta revocados',
  'permission.banner.message':
    'El navegador olvidó el acceso a {name}. Otorgalo de nuevo para seguir guardando.',
  'permission.banner.action': 'Otorgar acceso',

  'errors.unknown.title': 'Algo no salió como esperaba',
  'errors.unknown.message':
    'Ocurrió un error inesperado. Si vuelve a pasar, anotá el código y mirá docs/errors.md.',

  'errors.sys.001.title': 'Este navegador no es compatible',
  'errors.sys.001.message':
    'mi-cerebro necesita un navegador Chromium (Chrome, Edge, Vivaldi o Brave) para acceder a tus archivos.',

  'errors.sys.002.title': 'Espacio en disco insuficiente',
  'errors.sys.002.message':
    'No hay espacio para guardar este cambio. Probá vaciar la papelera o exportar y limpiar archivos viejos.',

  'errors.fs.001.title': 'Permiso denegado al guardar',
  'errors.fs.001.message':
    'El navegador revocó el permiso a tu carpeta, o el archivo está bloqueado por otro programa.',

  'errors.fs.002.title': 'No se pudo inicializar la carpeta',
  'errors.fs.002.message':
    'La carpeta elegida no es escribible o el sistema rechazó crear su contenido inicial. Probá con otra carpeta.',

  'errors.fs.003.title': 'Carpeta del workspace no encontrada',
  'errors.fs.003.message':
    'La carpeta raíz que usabas fue movida o eliminada. Vamos a pedirte que la elijas de nuevo.',

  'errors.fs.004.title': 'Permisos revocados',
  'errors.fs.004.message':
    'El navegador olvidó los permisos a tu carpeta. Otorgalos de nuevo desde el banner.',

  'errors.aut.005.title': 'Esta entidad está abierta en otra pestaña',
  'errors.aut.005.message':
    'Otra pestaña la está editando. Podés abrirla en solo lectura o tomar control desde acá.',

  'errors.aut.006.title': 'Se tomó control desde otra ventana',
  'errors.aut.006.message':
    'Otra pestaña tomó el control de esta entidad. Tu vista quedó en modo lectura.',
} as const;

export type EsDictionary = typeof es;
export type TranslationKey = keyof EsDictionary;
