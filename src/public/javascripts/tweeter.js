$("#tweet-textarea").keydown(function() {
  var tweetLength = $(this).val().length;
  var delta = 140 - tweetLength;
  $("#tweet-char").text(delta);
  if (parseFloat($("#tweet-char").text()) < 0) {
    $("#tweet-char").addClass("negative");
  } else {
    $("#tweet-char").removeClass("negative");
  }
});

$(".button").each(function(i) {
  $(this).click(() => {
    $(this).toggleClass("button-text");
    if ($(this).hasClass("button-text")) {
      $(this).text("Unfollow");
    } else {
      $(this).text("Follow");
    }
  })
});
