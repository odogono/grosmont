/* globals Crossing, jQuery, hljs */
(function ($, config) {
  var html;
  var $siteNav = $('#site-nav');
  var $siteNavToggle = $('.site-nav-toggle');

  $siteNavToggle.click(function () {
    $siteNav.toggleClass('is-toggled');
  });

  $('.post-content').fitVids();
  $('pre code[class]').each(function (i, block) {
    hljs.highlightBlock(block);
  });
}(jQuery));
