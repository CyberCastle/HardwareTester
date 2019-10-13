import { Context, RunningScriptOptions, runInNewContext } from 'vm'
import { SerialPortService } from '../../../driver/serialport/serial-port.service'
import { transform, types, NodePath } from '@babel/core'

// 5 seconds for timeout
var timeout = 5000
// Based in this piece of code: https://github.com/hacksparrow/safe-eval/blob/master/index.js
export class SafeEval {
    constructor(private sandboxContext: Context) {}

    public run(scriptContent: string) {
        const options: RunningScriptOptions = {
            displayErrors: true,
            timeout: timeout,
        }

        const resultKey = 'SAFE_EVAL_' + Math.floor(Math.random() * 1000000)
        this.sandboxContext[resultKey] = {}
        const clearContext = `
(function() {
    Function = undefined;
    const keys = Object.getOwnPropertyNames(this).concat(['constructor']);
    keys.forEach((key) => {
    const item = this[key];
    if (!item || typeof item.constructor !== 'function') return;
    this[key].constructor = undefined;
    });
})();
`
        scriptContent = clearContext + resultKey + '=' + scriptContent

        // Code injection for kill possibles infinite loops
        // Idea obtained from here: https://medium.com/@bvjebin/js-infinite-loops-killing-em-e1c2f5f2db7f
        scriptContent = transform(scriptContent, {
            plugins: [this.loopcontrol],
        }).code

        // console.log(scriptContent)
        runInNewContext(scriptContent, this.sandboxContext, options)
        return this.sandboxContext[resultKey]
    }

    public cancel() {}

    // Code based in piece obtained from here: https://medium.com/@bvjebin/js-infinite-loops-killing-em-e1c2f5f2db7f
    private loopcontrol() {
        // Code definition for break infinite loops
        function transformLoop(path: NodePath) {
            let variableName = path.scope.generateUidIdentifier('timer')
            let declaration = types.declareVariable(variableName)
            path.scope.parent.push(declaration)
            let definition = types.assignmentExpression(
                '=',
                variableName,
                types.callExpression(types.memberExpression(types.identifier('Date'), types.identifier('now')), [])
            )
            path.insertBefore(types.expressionStatement(definition))
            const lhs = types.parenthesizedExpression(types.binaryExpression('+', variableName, types.numericLiteral(timeout)))

            let bodyNode: NodePath = path.get('body') as NodePath
            bodyNode.insertAfter(
                types.ifStatement(
                    types.binaryExpression(
                        '>',
                        types.callExpression(types.memberExpression(types.identifier('Date'), types.identifier('now')), []),
                        lhs
                    ),
                    types.throwStatement(types.stringLiteral(`Script execution timed out after ${timeout}ms`)),
                    null
                )
            )
        }

        // Code injection for break infinite loops
        return {
            visitor: {
                WhileStatement: transformLoop,
                ForStatement: transformLoop,
                DoWhileStatement: transformLoop,
            },
        }
    }
}
