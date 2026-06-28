module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/steps/**/*.js', 'features/support/**/*.js'],
    formatOptions: { snippetInterface: 'async-await' },
  },
};
