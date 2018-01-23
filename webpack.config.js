module.exports = {
  entry: [
	'./app.js',
	__dirname + '/public/index.html'
  ],
  output: {
    path:     __dirname + '/build/',
    filename: './bundle.js',
  },
  module: {
    rules: [{
      test:   /\.html/, 
      loader: 'file-loader?name=[name].[ext]', 
    }]
  }
};

