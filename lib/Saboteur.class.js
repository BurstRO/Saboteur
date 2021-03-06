Saboteur = Class.extend({
  init  : (function(){
    return function( options, cards ){
      // General multi-purpose object. Will store in it all information regarding the game
      U.extend( this, {
        // {Array} list of all player objects
        players     : {},
        // {Object} class for holding map state information
        map         : {},
        // {Object}
        factory     : new Factory(),
        // {Object} class for holding event info: handle, check, execute
        events      : {},
        // {Object} the extended options object, stored for later use
        opt         : {},
        // {Object} the extended classes object, stored for later use
        cls         : {},
        // {Object} the extended cards object, stored for later use
        cards       : {},
        // {Array} array of player IDs in the order in which they will play the game
        turns       : [],
        // {Int} the current index in the this.turns representing the player to play
        currentTurn : 0
      });

      U.extend( true, this.opt, SO.options );
      U.extend( true, this.opt, options );
      U.extend( true, this.cards, SO.cards, cards );

      createFactory.call( this );
      createEvents.call( this );

    };

    function createFactory(){
      var details = {};
      for (var i in Deck) {
        details[Deck[i]] = {};
      };
      var startListDetails     = {};
      var gameListDetails      = {};
      var roleListDetails      = {};
      var goalListDetails      = {};
      var dummyGoalListDetails = {};

      U.extend( details[Deck.start], this.cards.start );
      U.extend( details[Deck.game], this.cards.path, this.cards.action );
      U.extend( details[Deck.role], this.cards.role );
      details[Deck.dummyGoal] = { GoalCard:U.objectLength(this.cards.goal) };
      details[Deck.goal] = this.cards.goal;

      // create the card decks
      this.factory.register(details);
    };

    function createEvents(){
      for (var h in Protocol.events.server.custom) {
        this.events[h] = {};
        U.extend(this.events[h], {
          handle  : function() {
            Logger.warn('Undefined handle for', h);
          },
          check : function() {
            Logger.warn('Undefined check for', h);
          },
          execute : function() {
            Logger.warn('Undefined execute for', h);
          }
        });
      };

      // EVENT discard
      U.extend(this.events.discard, {
        check : function(event) {
          var data = event.data;
          return this.doDiscard(true, data.playerID, data.cards);
        },
        execute : function(event) {
          var data = event.data;
          return this.doDiscard(false, data.playerID, data.cards);
        }
      });

      // EVENT targetPublicPlayer
      U.extend(this.events.targetPublicPlayer, {
        check : function(event) {
          var data = event.data;
          return this.doTargetPublicPlayer(true, data.playerID, data.playerCardID, data.targetID, data.targetCardID);
        },
        execute : function(event) {
          var data = event.data;
          return this.doTargetPublicPlayer(false, data.playerID, data.playerCardID, data.targetID, data.targetCardID);
        }
      });

      // EVENT targetPrivatePlayer
      U.extend(this.events.targetPrivatePlayer, {
        check : function(event) {
          var data = event.data;
          return this.doTargetPrivatePlayer(true, data.playerID, data.playerCardID, data.targetID);
        },
        execute : function(event) {
          var data = event.data;
          return this.doTargetPrivatePlayer(false, data.playerID, data.playerCardID, data.targetID);
        }
      });

      // EVENT targetMap
      U.extend(this.events.targetMap, {
        check : function(event) {
          var data = event.data;
          return this.doTargetMap(true, data.playerID, data.cardID, data.posx, data.posy, data.flipped);
        },
        execute : function(event) {
          var data = event.data;
          return this.doTargetMap(false, data.playerID, data.cardID, data.posx, data.posy, data.flipped);
        }
      });

      // EVENT heal
      U.extend(this.events.heal, {
        check : function(event) {
          var data = event.data;
          return this.doHeal(true, data.playerID, data.cards, data.targetCardID);
        },
        execute : function(event) {
          var data = event.data;
          return this.doHeal(false, data.playerID, data.cards, data.targetCardID);
        }
      });
    };

  })(),

  /**
   * Creates the set of options to be used on the map.
   * @param {BOOLEAN} useGoalCards -- indicate if to use goal or dummyGoal
   */
  createMapOptions : function(useGoalCards) {
    var goal = (useGoalCards ? Deck.goal : Deck.dummyGoal);
    var obj = {
      factory     : this.factory,
      maxCards    : this.factory.size(),
      startCards  : U.extend( true, [], this.opt.startCards).map(function(v,i){ v.unshift([Deck.start, i]); return v; }),
      goalCards   : U.extend( true, [], this.opt.goalCards).map(function(v,i){ v.unshift([goal, i]); return v; })
    };
    return obj;
  },

  setPlayers : function( players ){
    this.players = {};
    for( var i in players ){
      this.players[ i ] = new S.Player( players[i] );
    };
    return this;
  },

  cleanState : function() {
    this.players = {};
    this.map = {};
    this.turns = [];
    this.currentTurn = 0;
  },

  prepareTurn : function(playerID) {
    return true; // TODO: hacked for Stefan :p
    var player = this.players[playerID];
    // got player, his turn, first event
    if (player && this.currentTurn == player.public.turn && !player.public.playing) {
      player.public.playing = true;
      return true;
    } else {
      return false;
    };
  },

  advanceTurn : function() {
    // unset the playing state of the current player
    var playerID = this.turns[this.currentTurn];
    this.players[playerID].public.playing = false;
    // advance the play turn
    this.currentTurn++;
    if (this.currentTurn >= this.turns.length) {
      this.currentTurn = 0;
    };
    return this.currentTurn;
  },

  // EVENTS
  doDiscard : function(dryrun, playerID, cards) {
    var player = this.players[playerID];
    if (!player) {
      return false;
    } else {
      var hand = player.private.hand;
      if (hand.validateCards(cards)) {
        if (!dryrun) {
          hand.remove(cards);
        };
        return true;
      } else {
        return false;
      };
    };
  },

  /**
   * @return true if can be done, false otherwise
   */
  doTargetPublicPlayer : function(dryrun, playerID, playerCardID, targetId, targetCardID) {
    var player = this.players[playerID];
    if (!player) {
      return false;
    } else {
      var target = this.players[targetID];
      var card = (player.private.hand.has(playerCardID)
                    ? this.factory.get(Deck.game, playerCardID)
                    : null);

      if (!target || !card || !(card instanceof PublicPlayerActionCard)) {
        return false;
      } else {
        return card.execute(dryrun, target, targetCardID);
      };
    };
  },

  /**
   * @return true if can be done, false otherwise, null if you asked to execute
   */
  doTargetPrivatePlayer : function(dryrun, playerID, playerCardID, targetID) {
    var player = this.players[playerID];
    if (!player) {
      return false;
    } else {
      var target = this.players[targetID];
      var card = (player.private.hand.has(playerCardID)
                    ? this.factory.get(Deck.game, playerCardID)
                    : null);

      if (!target || !card || !(card instanceof S.PrivatePlayerActionCard)) {
        return false;
      } else {
        return (dryrun ? true : null);
      };
    };
  },

  doTargetMap : function(dryrun, playerID, cardID, posx, posy, flipped) {
    var player = this.players[playerID];

    if (!player) {
      return false;
    } else {
      var card = (player.private.hand.has(cardID)
                    ? this.factory.get(Deck.game, cardID)
                    : null);

      if (!card || !(card instanceof S.MapCard)) {
        return false;
      } else {
        return card.execute(dryrun, this.map, posx, posy, flipped);
      };
    };
  },

  doHeal : function(dryrun, playerID, cards, targetCardID) {
    var player = this.players[playerID];

    if ( !player
      || !cards.length == this.opt.healDiscard
      || !player.private.hand.validateCards(cards))
    {
      return this.doDiscard(dryrun, playerID, cards);
    } else {
      return false;
    };
  }
});
