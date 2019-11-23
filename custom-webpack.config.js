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
        ])
    ]
}
