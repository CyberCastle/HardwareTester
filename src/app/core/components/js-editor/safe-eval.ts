import { Context, RunningScriptOptions, runInNewContext } from 'vm'
import { SerialPortService } from '../../../driver/serialport/serial-port.service'
import * as babel from '@babel/core'

export class SafeEval {
    // 2 seconds for timeout
    private readonly timeout = 2000

    constructor(private portService: SerialPortService) {}

    public run(scriptContent: string) {
        const options: RunningScriptOptions = {
            displayErrors: true,
            timeout: this.timeout,
        }

        const sandboxContext: Context = {
            portService: SerialPortService,
            console: console,
        }

        const resultKey = 'SAFE_EVAL_' + Math.floor(Math.random() * 1000000)
        sandboxContext[resultKey] = {}
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
        scriptContent = babel.transform(scriptContent, {
            plugins: [this.loopcontrol],
        }).code

        runInNewContext(scriptContent, sandboxContext, options)
        return sandboxContext[resultKey]
    }

    public async cancel(): Promise<number> {
        return null
    }

    // Piece of code obtained from here: https://medium.com/@bvjebin/js-infinite-loops-killing-em-e1c2f5f2db7f
    loopcontrol(babel: { types: any }) {
        const t = babel.types
        return {
            visitor: {
                WhileStatement: function transformWhile(path: any) {
                    let variableName = path.scope.generateUidIdentifier('timer')
                    let declaration = t.declareVariable(variableName)
                    path.scope.parent.push(declaration)
                    let definition = t.assignmentExpression(
                        '=',
                        variableName,
                        t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), [])
                    )
                    path.insertBefore(t.expressionStatement(definition))
                    const lhs = t.parenthesizedExpression(t.binaryExpression('+', variableName, t.NumericLiteral(3000)))
                    path.get('body').pushContainer(
                        'body',
                        t.ifStatement(
                            t.binaryExpression(
                                '>',
                                t.callExpression(t.memberExpression(t.identifier('Date'), t.identifier('now')), []),
                                lhs
                            ),
                            t.throwStatement(t.stringLiteral('Script execution timed out after 3000ms')),
                            null
                        )
                    )
                },
            },
        }
    }
}
