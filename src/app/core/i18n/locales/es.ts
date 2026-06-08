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
  'common.reauthorize': 'Reautorizar',

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

  'errors.aut.001.title': 'No se pudo guardar el borrador',
  'errors.aut.001.message':
    'No pude escribir el borrador local de tu trabajo. Tus cambios siguen en memoria, pero podrían perderse si cerrás la pestaña.',

  'errors.aut.002.title': 'No se pudo recuperar el borrador',
  'errors.aut.002.message':
    'Encontré un borrador pendiente pero no pude leerlo. Continuá editando para sobrescribirlo.',

  'errors.idb.001.title': 'No se pudo abrir el almacén local',
  'errors.idb.001.message':
    'IndexedDB rechazó la apertura. Suele pasar en modo incógnito con bloqueo estricto o cuando otra pestaña tiene una versión vieja abierta.',

  'errors.idb.002.title': 'Falló una operación de almacenamiento local',
  'errors.idb.002.message':
    'Una lectura o escritura en IndexedDB falló. Si se repite, anotá el código y mirá docs/errors.md.',

  'errors.mig.001.title': 'Falló una migración de schema',
  'errors.mig.001.message':
    'La migración a la versión nueva falló a mitad de camino. Tenés un backup completo en .mi-cerebro/pre-migration/.',

  'errors.mig.002.title': 'Versión de schema desconocida',
  'errors.mig.002.message':
    'Este archivo viene de una versión más nueva de mi-cerebro. Actualizá la app o abrí el archivo desde la versión que lo creó.',

  'errors.ent.001.title': 'Archivo dañado o ilegible',
  'errors.ent.001.message':
    'El JSON de esta entidad no pudo parsearse. Suele pasar si un editor externo lo cortó a mitad o guardó en otro encoding. Hay un backup del último guardado correcto.',

  'errors.ent.002.title': 'Hay otra entidad con el mismo ID',
  'errors.ent.002.message':
    'Encontré dos archivos distintos compartiendo el mismo ID interno. Renombrá o eliminá una de las copias antes de seguir.',

  'notes.title': 'Notas',
  'notes.new': 'Nueva nota',
  'notes.untitledTitle': 'Sin título',
  'notes.empty': 'Sin notas todavía. Empezá con "Nueva nota".',
  'notes.placeholderTitle': 'Título...',
  'notes.placeholderBody': 'Escribí algo...',
  'notes.deleteConfirm': '¿Mover "{title}" a la papelera?',
  'notes.delete': 'Eliminar',
  'notes.status.saved': 'Guardado',
  'notes.status.saving': 'Guardando...',
  'notes.status.unsaved': 'Sin guardar',
  'notes.selectOne': 'Elegí una nota o creá una nueva.',

  'tree.filter.placeholder': 'Filtrar...',
  'tree.noMatches': 'Sin coincidencias.',
  'tree.matches.count': '{n} coincidencias',
  'tree.direction.label': 'Dirección de búsqueda',
  'tree.direction.general': 'General (más cerca)',
  'tree.direction.up': 'Hacia arriba',
  'tree.direction.down': 'Hacia abajo',

  'tags.placeholder': 'Agregar etiqueta...',
  'tags.createPrefix': 'Crear',
  'tags.empty': 'Sin etiquetas.',

  'palette.label': 'Búsqueda global',
  'palette.openButton': 'Abrir búsqueda global',
  'palette.placeholder': 'Buscar... (probá tag:trabajo)',
  'palette.empty': 'Escribí para buscar entre tus notas.',
  'palette.unknownTag': 'No existe la etiqueta',
  'palette.hint': '↑↓ navegar · enter abrir · esc cerrar',
  'palette.kindUnknown': 'Otro',

  'errors.aut.005.title': 'Esta entidad está abierta en otra pestaña',
  'errors.aut.005.message':
    'Otra pestaña la está editando. Podés abrirla en solo lectura o tomar control desde acá.',

  'errors.aut.006.title': 'Se tomó control desde otra ventana',
  'errors.aut.006.message':
    'Otra pestaña tomó el control de esta entidad. Tu vista quedó en modo lectura.',

  'notes.lock.foreign.title': 'Esta nota está abierta en otra pestaña',
  'notes.lock.foreign.message':
    'Para evitar pisar cambios, esta nota está en modo lectura. Podés tomar control para empezar a editar acá.',
  'notes.lock.foreign.readonly': 'Abrir solo lectura',
  'notes.lock.foreign.takeover': 'Tomar control',
  'notes.lock.evicted.title': 'Otra ventana tomó el control',
  'notes.lock.evicted.message':
    'Otra pestaña empezó a editar esta nota. Tu vista quedó en modo lectura.',
  'notes.lock.evicted.dismiss': 'Entendido',
  'notes.lock.readonly': 'Solo lectura',

  'tasks.title': 'Tareas',
  'tasks.new': 'Nueva tarea',
  'tasks.untitledTitle': 'Sin título',
  'tasks.empty': 'Sin tareas todavía. Empezá con "Nueva tarea".',
  'tasks.placeholderTitle': 'Título...',
  'tasks.placeholderBody': 'Notas, contexto, sub-pasos...',
  'tasks.deleteConfirm': '¿Mover "{title}" a la papelera?',
  'tasks.delete': 'Eliminar',
  'tasks.status.saved': 'Guardado',
  'tasks.status.saving': 'Guardando...',
  'tasks.status.unsaved': 'Sin guardar',
  'tasks.selectOne': 'Elegí una tarea o creá una nueva.',
  'tasks.done.label': 'Hecha',
  'tasks.due.label': 'Fechas',
  'tasks.due.add': 'Agregar fecha',
  'tasks.due.remove': 'Quitar',
  'tasks.due.placeholder': 'AAAA-MM-DD',
  'tasks.due.overdue': 'Vencida',
  'tasks.due.today': 'Hoy',
  'tasks.due.tomorrow': 'Mañana',
  'tasks.lock.foreign.title': 'Esta tarea está abierta en otra pestaña',
  'tasks.lock.foreign.message':
    'Para evitar pisar cambios, esta tarea está en modo lectura. Podés tomar control para empezar a editar acá.',
  'tasks.lock.foreign.readonly': 'Abrir solo lectura',
  'tasks.lock.foreign.takeover': 'Tomar control',
  'tasks.lock.evicted.title': 'Otra ventana tomó el control',
  'tasks.lock.evicted.message':
    'Otra pestaña empezó a editar esta tarea. Tu vista quedó en modo lectura.',
  'tasks.lock.evicted.dismiss': 'Entendido',

  'goals.title': 'Metas',
  'goals.new': 'Nueva meta',
  'goals.untitledTitle': 'Sin título',
  'goals.empty': 'Sin metas todavía. Empezá con "Nueva meta".',
  'goals.placeholderTitle': 'Título...',
  'goals.placeholderBody': '¿Por qué? ¿Cómo? Sub-pasos, hitos...',
  'goals.deleteConfirm': '¿Mover "{title}" a la papelera?',
  'goals.delete': 'Eliminar',
  'goals.status.saved': 'Guardado',
  'goals.status.saving': 'Guardando...',
  'goals.status.unsaved': 'Sin guardar',
  'goals.selectOne': 'Elegí una meta o creá una nueva.',
  'goals.completed.label': 'Completada',
  'goals.deadline.label': 'Plazo',
  'goals.deadline.add': 'Definir plazo',
  'goals.deadline.remove': 'Quitar plazo',
  'goals.deadline.none': 'Sin plazo',
  'goals.deadline.today': 'Hoy',
  'goals.deadline.tomorrow': 'Mañana',
  'goals.lock.foreign.title': 'Esta meta está abierta en otra pestaña',
  'goals.lock.foreign.message':
    'Para evitar pisar cambios, esta meta está en modo lectura. Podés tomar control para empezar a editar acá.',
  'goals.lock.foreign.readonly': 'Abrir solo lectura',
  'goals.lock.foreign.takeover': 'Tomar control',
  'goals.lock.evicted.title': 'Otra ventana tomó el control',
  'goals.lock.evicted.message':
    'Otra pestaña empezó a editar esta meta. Tu vista quedó en modo lectura.',
  'goals.lock.evicted.dismiss': 'Entendido',
  'goals.reminder.title': 'Recordatorio de meta',
  'goals.reminder.dismiss': 'Cerrar',
  'goals.reminder.open': 'Abrir',
  'goals.reminder.overdue': 'Plazo vencido',
  'goals.reminder.dueSoon': 'Vence pronto',

  'lists.title': 'Listas',
  'lists.new': 'Nueva lista',
  'lists.untitledTitle': 'Sin título',
  'lists.empty': 'Sin listas todavía. Empezá con "Nueva lista".',
  'lists.placeholderTitle': 'Título...',
  'lists.placeholderBody': 'Ítems, ideas, lo que sea...',
  'lists.deleteConfirm': '¿Mover "{title}" a la papelera?',
  'lists.delete': 'Eliminar',
  'lists.status.saved': 'Guardado',
  'lists.status.saving': 'Guardando...',
  'lists.status.unsaved': 'Sin guardar',
  'lists.selectOne': 'Elegí una lista o creá una nueva.',
  'lists.lock.foreign.title': 'Esta lista está abierta en otra pestaña',
  'lists.lock.foreign.message':
    'Para evitar pisar cambios, esta lista está en modo lectura. Podés tomar control para empezar a editar acá.',
  'lists.lock.foreign.readonly': 'Abrir solo lectura',
  'lists.lock.foreign.takeover': 'Tomar control',
  'lists.lock.evicted.title': 'Otra ventana tomó el control',
  'lists.lock.evicted.message':
    'Otra pestaña empezó a editar esta lista. Tu vista quedó en modo lectura.',
  'lists.lock.evicted.dismiss': 'Entendido',

  'folders.newIn': 'Carpeta en {kind}',
  'folders.createPrompt': 'Nombre de la carpeta:',
  'folders.actionPrompt': '¿Qué querés hacer con esta carpeta?',
  'folders.rename': 'Renombrar',
  'folders.move': 'Mover',
  'folders.delete': 'Eliminar',
  'folders.renamePrompt': 'Nuevo nombre:',
  'folders.movePrompt': 'Nueva carpeta padre (ruta relativa; vacío = raíz):',
  'folders.deleteConfirm': '¿Eliminar la carpeta "{path}" y mover todo su contenido a la papelera?',
  'folders.entityMovePrompt': 'Mover a carpeta (ruta relativa; vacío = raíz):',

  'trash.title': 'Papelera',
  'trash.empty': 'Vaciar papelera',
  'trash.emptyState': 'La papelera está vacía.',
  'trash.restore': 'Restaurar',
  'trash.purge': 'Borrar',
  'trash.purgeConfirm': '¿Borrar "{title}" definitivamente? Esta acción es irreversible.',
  'trash.emptyConfirm': '¿Vaciar la papelera? Todo el contenido se borrará definitivamente.',
  'trash.untitledTitle': 'Sin título',
  'trash.kind.note': 'Nota',
  'trash.kind.task': 'Tarea',
  'trash.kind.goal': 'Meta',
  'trash.kind.list': 'Lista',

  'tree.type.all': 'Todo',
  'tree.type.notes': 'Notas',
  'tree.type.tasks': 'Tareas',
  'tree.type.goals': 'Metas',
  'tree.type.lists': 'Listas',
} as const;

export type EsDictionary = typeof es;
export type TranslationKey = keyof EsDictionary;
