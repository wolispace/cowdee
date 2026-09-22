<!DOCTYPE html>
<?php 
  $version = '0.5.0'; 
  $rnd = rand(0, 999999); ?>
<html>
  <head>
    <meta charset='utf-8'>
    <title>cowdee <?=$version?></title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
      <link rel='stylesheet' href='cowdee.css?<?=$rnd?>' />
      <script type="module" src='cowdee.js?<?=$rnd?>'></script>
  </head>
  <body>
    <content>
      <div id="panels">
        <section id="top">
          <h2>Welcome to cow</h2>
          <p>Log in to enter the world.</p>
           
        </section>
        <div id="splitter"><hr/></div>
        <section id="bottom">
        </section>
      </div>
      <select id="history" class="history-select" size="10" hidden></select>
      <form id="input" class="commandform" autocomplete="off">
        <input type="hidden" name="type" value="cmd" />
        <label for="cmd" class="commandlabel">Cmd </label>
        <input type="text" class="commandterm" name="cmd" id="cmd" placeholder="What do you want to do?" 
          value="" 
          autofocus 
          spellcheck="false"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
           />
        <input type="submit" class="commandbutton" value="Go" />
      </form> 
    </content>
    <div id="menu">&#9776;</div>
    <dialog id="dialog" class="buttonize"></dialog>
  </body>
</html>
