const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
var nodeModules = path.resolve(__dirname, 'node_modules')
module.exports = {
    plugins: [
        new CopyWebpackPlugin([
            {
                context: nodeModules + '/fontconverter-wasm/dist',
                from: 'fontconverter.wasm',
                to: 'wasm/fontconverter.wasm'
            },
            { from: 'src/assets', to: 'assets' }
        ]),
        // Ignore << Critical dependency: the request of a dependency is an expression >> using prettier
        // Idea: https://medium.com/tomincode/hiding-critical-dependency-warnings-from-webpack-c76ccdb1f6c1
        new webpack.ContextReplacementPlugin(/prettier/, data => {
            data.dependencies.forEach(dependency => {
                delete dependency.critical
            })

            return data
        })
    ],
    // Fix << Module not found: Error: Can't resolve '@microsoft/typescript-etw' >>
    // Idea: https://github.com/microsoft/monaco-editor/issues/1623#issuecomment-546583647
    externals: { '@microsoft/typescript-etw': 'FakeModule' }
}
