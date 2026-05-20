import { autocompletion, snippetCompletion, type Completion } from '@codemirror/autocomplete'

const LUA_API_SNIPPETS: { label: string; type?: string; apply: string }[] = [
  { label: 'entity.setPosition',      type: 'function', apply: 'entity.setPosition(${id}, ${x}, ${y})' },
  { label: 'entity.setVelocity',      type: 'function', apply: 'entity.setVelocity(${id}, ${vx}, ${vy})' },
  { label: 'entity.position',         type: 'function', apply: 'entity.position(${id})' },
  { label: 'entity.velocity',         type: 'function', apply: 'entity.velocity(${id})' },
  { label: 'entity.destroy',          type: 'function', apply: 'entity.destroy(${id})' },
  { label: 'pool.getAll',             type: 'function', apply: 'pool.getAll("${ClassName}")' },
  { label: 'pool.getFirst',           type: 'function', apply: 'pool.getFirst("${ClassName}")' },
  { label: 'pool.count',              type: 'function', apply: 'pool.count("${ClassName}")' },
  { label: 'input.isKeyDown',         type: 'function', apply: 'input.isKeyDown("${W}")' },
  { label: 'input.wasKeyPressed',     type: 'function', apply: 'input.wasKeyPressed("${Space}")' },
  { label: 'input.wasKeyReleased',    type: 'function', apply: 'input.wasKeyReleased("${Space}")' },
  { label: 'collision.overlap',       type: 'function', apply: 'collision.overlap(${id1}, ${id2})' },
  { label: 'collision.touchingClass', type: 'function', apply: 'collision.touchingClass(${id}, "${Ground}")' },
  { label: 'audio.playSound',         type: 'function', apply: 'audio.playSound("${path}", ${1.0}, ${1.0})' },
  { label: 'audio.playMusic',         type: 'function', apply: 'audio.playMusic("${path}", ${true})' },
  { label: 'audio.stopAll',           type: 'function', apply: 'audio.stopAll()' },
  { label: 'state.get',               type: 'function', apply: 'state.get("${key}")' },
  { label: 'state.set',               type: 'function', apply: 'state.set("${key}", ${value})' },
  { label: 'state.add',               type: 'function', apply: 'state.add("${key}", ${1})' },
  { label: 'debug.log',               type: 'function', apply: 'debug.log(${msg})' },
  { label: 'event.emit',              type: 'function', apply: 'event.emit("${name}", ${{}})' },
  { label: 'event.on',                type: 'function', apply: 'event.on("${name}", function(data)\n\t\nend)' },
  { label: 'time.elapsed',            type: 'property', apply: 'time.elapsed()' },
  { label: 'save.write',              type: 'function', apply: 'save.write("${slot}", ${data})' },
  { label: 'save.read',               type: 'function', apply: 'save.read("${slot}")' },
]

const completions: Completion[] = LUA_API_SNIPPETS.map((s) =>
  snippetCompletion(s.apply, { label: s.label, type: s.type }),
)

export const artcadeLuaCompletion = autocompletion({
  override: [
    (context) => {
      const word = context.matchBefore(/\w[\w.]*$/)
      if (!word && !context.explicit) return null
      return { from: word ? word.from : context.pos, options: completions }
    },
  ],
})
