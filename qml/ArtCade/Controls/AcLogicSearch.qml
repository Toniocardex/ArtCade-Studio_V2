import QtQuick
import ArtCade.Ui

/**
 * Logic Board query engine — parses queries like
 *   trigger:collision action:"Play Sound" uses:coin is:disabled free text
 * and matches rule summary maps from EditorSession.logicRules.
 * Operators: trigger: / condition: / action: (block names+ids),
 * uses: (property values and labels), is: enabled|disabled|error|warning.
 * Bare terms match anywhere; tokens are ANDed. View-side helper only.
 */
QtObject {
    id: root

    /** Parses a query into [{op, term}] tokens (terms lowercased). */
    function parse(text) {
        const tokens = []
        const known = ["trigger", "condition", "action", "uses", "is"]
        const re = /(?:(\w+):)?(?:"([^"]*)"|(\S+))/g
        let m
        while ((m = re.exec(text)) !== null) {
            const op = (m[1] || "").toLowerCase()
            const term = (m[2] !== undefined ? m[2] : (m[3] || "")).toLowerCase()
            if (term.length === 0)
                continue
            if (op.length > 0 && known.indexOf(op) >= 0)
                tokens.push({ op: op, term: term })
            else if (op.length > 0)
                tokens.push({ op: "", term: op + ":" + term })
            else
                tokens.push({ op: "", term: term })
        }
        return tokens
    }

    /** Terms worth highlighting inside rule summaries (is: flags excluded). */
    function highlightTerms(tokens) {
        const out = []
        for (let i = 0; i < tokens.length; ++i) {
            if (tokens[i].op !== "is")
                out.push(tokens[i].term)
        }
        return out
    }

    function blockText(typeIds) {
        let out = ""
        for (let i = 0; i < typeIds.length; ++i)
            out += EditorSession.logicBlockDisplayName(typeIds[i]).toLowerCase()
                   + " " + String(typeIds[i]).toLowerCase() + " "
        return out
    }

    function propsText(props) {
        let out = ""
        if (!props)
            return out
        for (let i = 0; i < props.length; ++i) {
            out += String(props[i].value).toLowerCase() + " "
            if (props[i].valueLabel !== undefined)
                out += String(props[i].valueLabel).toLowerCase() + " "
        }
        return out
    }

    function tokenMatches(rule, token) {
        if (token.op === "is") {
            if (token.term === "disabled")
                return rule.enabled !== true
            if (token.term === "enabled")
                return rule.enabled === true
            if (token.term === "error")
                return (rule.errorCount || 0) > 0
            if (token.term === "warning")
                return (rule.warningCount || 0) > 0
            return false
        }
        const trigger = blockText([rule.triggerTypeId || ""])
                        + propsText(rule.triggerProperties)
        const conditions = blockText(rule.conditionTypeIds || [])
                           + propsText(rule.conditionProperties)
        const actions = blockText(rule.actionTypeIds || [])
                        + propsText(rule.actionProperties)
        if (token.op === "trigger")
            return trigger.indexOf(token.term) >= 0
        if (token.op === "condition")
            return conditions.indexOf(token.term) >= 0
        if (token.op === "action")
            return actions.indexOf(token.term) >= 0
        if (token.op === "uses")
            return (propsText(rule.triggerProperties)
                    + propsText(rule.conditionProperties)
                    + propsText(rule.actionProperties)).indexOf(token.term) >= 0
        return (trigger + conditions + actions
                + String(rule.id).toLowerCase()).indexOf(token.term) >= 0
    }

    /** True when the rule satisfies every token (AND). */
    function ruleMatches(rule, tokens) {
        for (let i = 0; i < tokens.length; ++i) {
            if (!tokenMatches(rule, tokens[i]))
                return false
        }
        return true
    }
}
