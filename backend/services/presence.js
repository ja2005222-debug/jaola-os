/**
 * 👥 حضور مبسّط عبر socket.io — كم جلسة/جهاز لنفس مالك المشروع متصل بغرفته
 * الآن. لا مشاركة بين حسابات مختلفة (المنصّة لا تملك مفهوم فريق/دعوة على
 * مشروع بعد) — هذه خطوة أولى فقط: تحذير "أنت متصل أيضاً من جهاز آخر"
 * لصاحب المشروع نفسه، قبل أي تعارض تعديل غير مقصود بين جلساته.
 */

/** يبثّ عدد المتصلين الحاليين بغرفة مشروع لكل من فيها. */
export function broadcastPresence(io, roomName) {
    const room = io.sockets.adapter.rooms.get(roomName);
    io.to(roomName).emit('presence', { count: room ? room.size : 0 });
}
