import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import path, {dirname} from "path";
import {fileURLToPath} from "url";
const directory = dirname(fileURLToPath(import.meta.url));
export default {
    mode: 'development',
    entry: './src/webapp/index.js',
    output: {
        path: path.resolve(directory, 'dist/static'),
        filename: 'webapp.bundle.js',
    },
    plugins: [
        new HtmlWebpackPlugin({ template: './src/webapp/index.html' }),
        new CopyPlugin({
            patterns: [
                { from: "src/webapp/images", to: "images" }
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        alias: {
            //'vue$': 'vue/dist/vue.cjs.js',
            //'axios$': 'axios/dist/axios.js',
        },
        extensions: ['*', '.js','.json']
    }
};
