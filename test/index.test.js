var path = require('path');
var fs = require('fs');
var expect = require('chai').expect;
var BroccoliCachingWriter = require('broccoli-caching-writer');
var broccoli = require('broccoli');
var cheerio = require('cheerio');

var SvgProcessor = require('..');
var SOURCE_DIR_GROUP_1 = path.normalize('test/fixtures/input/group-1');
var SOURCE_DIR_GROUP_2 = path.normalize('test/fixtures/input/group-2');
var SOURCE_DIR_SVGSTORE_OPTS = path.normalize('test/fixtures/input/standalone-svgs/svgstore-opts');

var OUTPUT_FILE = path.normalize('test/fixtures/output/test-symbols.html');
var ANNOTATION = 'testing processor'; 

var DEFAULT_OPTS = {
  annotation: ANNOTATION,
  outputFile: OUTPUT_FILE
};

var ID_MANIFEST = {};
ID_MANIFEST[SOURCE_DIR_GROUP_1] = ['icon-circles', 'icon-triangle', 'icon-star', 'icon-spark'];
ID_MANIFEST[SOURCE_DIR_GROUP_2] = ['icon-square', 'icon-smiley', 'icon-movie-ticket'];
ID_MANIFEST[SOURCE_DIR_SVGSTORE_OPTS] = ['svgstore-opts'];

function makeBuilderFromInputNodes(inputNodes, options) {
  var options = options || {};
  var svgProcessor = new SvgProcessor(inputNodes, {
    outputFile: options.outputFile || OUTPUT_FILE,
    annotation: options.annotation || 'SVGStore Processor -- Tests',
    svgstoreOpts: options.svgstoreOpts || {} 
  });
  
  return new broccoli.Builder(svgProcessor); 
}

function loadSVG(filePath) {
  var fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
  return cheerio.load(fileContent, { xmlMode: true });
}

function testForSymbols($loadedSVG, expectedSymbolIds) {
  
  // test proper structure
  var $svg = $loadedSVG('svg');
  
  var svgElem = $svg[0];
  expect(svgElem.name).to.equal('svg');
  expect(svgElem.type).to.equal('tag');

  // test symbols (NOTE: this is cheerio's jQuery-style `filter`, so... idx and elem are backwards 😎)
  var symbols = $svg.children().filter(function (idx, elem) {
    return elem.name && elem.name === 'symbol';
  });

  expect(symbols.length).to.equal(expectedSymbolIds.length);

  expectedSymbolIds.forEach(function (id, idx) {
    var $symbol = $loadedSVG('svg #' + id).first();
    expect($symbol[0].tagName).to.equal('symbol');
    expect($symbol.attr('id')).to.equal(id);
  });
}


var svgProcessor, builder;

describe('SVGProcessor', function () {
  
  afterEach(function() {
    if (builder) {
      return builder.cleanup();
    }
  });

  describe('construction', function() {  
    
    it('extends `broccoli-caching-writer`', function() {
      svgProcessor = new SvgProcessor([SOURCE_DIR_GROUP_1], DEFAULT_OPTS);
      expect(svgProcessor).to.be.an.instanceof(BroccoliCachingWriter);
    });

    it('throws on falsey `inputNodes`', function () {    
      function TestProcessor(inputNodes, options) {
        options = options || DEFAULT_OPTS;
        SvgProcessor.call(this, inputNodes, options);
      }
      TestProcessor.prototype = Object.create(SvgProcessor.prototype);
      TestProcessor.prototype.constructor = TestProcessor;    
      TestProcessor.prototype.build = function() {};    

      var errorMsgPrefix = 'TestProcessor (' + ANNOTATION + '): Expected a non-falsey argument for `_inputNode`, got ';
      
      expect(function() {
        new TestProcessor();
      }).to.throw(TypeError, errorMsgPrefix + 'undefined');

      expect(function() {
        new TestProcessor(null);
      }).to.throw(TypeError, errorMsgPrefix + 'null');

      expect(function() {
        new TestProcessor(undefined);
      }).to.throw(TypeError, errorMsgPrefix + 'undefined');

      expect(function() {
        new TestProcessor(false);
      }).to.throw(TypeError, errorMsgPrefix + 'false');  
    });
  });


  describe('build', function() {

    it('writes all SVGs in a single directory to the target outputFile', function() {      
      var inputNodes = [SOURCE_DIR_GROUP_1];
      builder = makeBuilderFromInputNodes(inputNodes);

      return builder.build().then(function(results) {
        var outputDestination = path.join(results.directory, path.normalize(OUTPUT_FILE));
        
        testForSymbols(loadSVG(outputDestination), ID_MANIFEST[SOURCE_DIR_GROUP_1]);
      });    
    });

    it('writes all SVGs from a list of directories to the target outputFile', function() {
      var inputNodes = [SOURCE_DIR_GROUP_1, SOURCE_DIR_GROUP_2];
      builder = makeBuilderFromInputNodes(inputNodes);

      return builder.build().then(function(results) {
        var outputDestination = path.join(results.directory, path.normalize(OUTPUT_FILE));
        var symbolIds = ID_MANIFEST[SOURCE_DIR_GROUP_1].concat(ID_MANIFEST[SOURCE_DIR_GROUP_2]);  

        testForSymbols(loadSVG(outputDestination), symbolIds);
      });      
    });

    // TODO: Implement test
    it('passes options to SVGStore', function() {
      var inputNode = SOURCE_DIR_SVGSTORE_OPTS;
      var CUSTOM_ATTR_VALUES = {
        'x-custom-attr': 'foo'
      };

      builder = makeBuilderFromInputNodes(inputNode, {
        svgstoreOpts: { customSymbolAttrs: ['x-custom-attr'] }        
      });

      return builder.build().then(function (results) {
        var outputDestination = path.join(results.directory, path.normalize(OUTPUT_FILE));
        var symbolId = ID_MANIFEST[SOURCE_DIR_SVGSTORE_OPTS];

        var $ = loadSVG(outputDestination);
        testForSymbols($, symbolId);

        expect($('symbol').attr('x-custom-attr')).to.equal(CUSTOM_ATTR_VALUES['x-custom-attr']);
      });
    });
  });
});

