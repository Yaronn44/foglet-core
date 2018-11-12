/*
This broadcast implementation  is clearly inspired from https://github.com/Chat-Wane/CausalBroadcastDefinition
This is a broadcast customizable, if you want to specifiy
Ensure single delivery and causality between 2 consecutive messages from a single site
*/
'use strict'

const AbstractBroadcast = require('./../abstract/abstract-broadcast.js')
const VVwE = require('version-vector-with-exceptions') // Version-Vector With Exceptions
const messages = require('./messages.js')

const uuid = require('uuid/v4')
const sortedIndexBy = require('lodash.sortedindexby')
const debug = (require('debug'))('foglet-core:broadcast')

/**
 * Format the IDs of messages in string format
 * @param  {Obbject} message - The message to format
 * @return {string} The formatted message's id in string format
 */
function formatID (message) {
  return `e=${message.id.e}&c=${message.id.c}`
}

/**
 * Broadcast represent the base implementation of a broadcast protocol for the foglet library.
 * Based on the CausalBrodacastDefinition Package: see: https://github.com/Chat-Wane/CausalBroadcastDefinition
 * @extends AbstractBroadcast
 * @author Arnaud Grall (Folkvir)
 */
class Broadcast extends AbstractBroadcast {
  
  

  /**
   * Constructor
   * @param  {AbstractNetwork} source - The source RPS/overlay
   * @param  {string} protocol - The name of the broadcast protocol
   */
  constructor (source, protocol) {
    super(source, protocol)
    if (source && protocol) {
      this.options = {
        id: source.id,
        delta: 1000 * 30
      }
      // Connexions inview et outview donc ne récupérer que les outview
      this._source.rps.on('open', (id) => {
        if(this._source.getNeighbours().includes(id)) {
          console.log('[%s] open', this.options.id, id)
        }
      })
      const self = this

      // Connexions inview et outview donc ne récupérer que les outview
      this._source.rps.on('close', (id) => {
        console.log('close', id)
      })

      // the id is your id, base on the .PEER id in the RPS options
      this._causality = new VVwE(this.options.id)

      this.received = []                          // map of messages received
      this.safeNeighbours = []                    // Q
      this.messagesBuffer = new messagesBuffer()  // B
      this.messagesId = []                        // I
      this.nbRetries = []                         // R
      this.pingCounter = 0                        // counter
      this.causalCounter = 0
      this.causalBuffer = new causalBuffer()

      this.maxSize = Number.MAX_SAFE_INTEGER
      this.maxRetry = Number.MAX_SAFE_INTEGER
    } else {
      return new Error('Not enough parameters', 'fbroadcast.js')
    }
  }

  /**
   * Send a message to all neighbours
   * @private
   * @param  {Object} message - The message to send
   * @return {void}
   */
  _sendAll (message) {
    var n = this.safeNeighbours
    // please select all distinct ids
    if (n.length > 0) {
      n.forEach(p => {
        this._unicast.send(p, message).catch(e => {
          debug(e)
        })
      })
    }
  }

  /**
   * Send a message in broadcast
   * @param  {Object}  message  - The message to send
   * @param  {Object} [id] {e: <stringId>, c: <Integer>} this uniquely represents the id of the operation
   * @param  {Object} [isReady] {e: <stringId>, c: <Integer>} this uniquely represents the id of the operation that we must wait before delivering the message
   * @return {boolean}
   */
  send (id, message) {
    console.log('i send my beautiful message: ', this.options.id, message)

    this._receive(this.options.id, message)
    this._sendAll(message) // We send to all safe neighbours the message

    //We know have to try to safe a way with the other neighbours
    this._source.getNeighbours().forEach(q => {
      // if the neighbour is not already safe we try to set up a safe connexion
      if(!this.safeNeighbours.include(q)){
        this.ping(this.options.id,q,)
        // TODO should store message into a buffer to send them when the pong come
      }
    })

  }

  /**
   * Handler executed when a message is recevied
   * @param  {string} id  - Message issuer's ID
   * @param  {Object} message - The message received
   * @return {void}
   */
  _receive (id, message) {
    this.emit('receive', id, message)
    var index = this.received.indexOf(map => map[0] === id)
    if(index == -1){
      this.received.push([id, 0])
      index = this.received.indexOf(map => map[0] === id)
    } 
    if (message.counter - this.received[index][1] == 1){
      this.received[index].splice(1, 1, message.counter)
    } else{
      index = this.causalBuffer.indexOf(map => map[0] === id)
      if(index == -1){
        this.causalBuffer.addUser(id)
        index = this.causalBuffer.indexOf(map => map[0] === id)
      }      
      this.causalBuffer.addMessage(id, message)
    }

    if(this.causalBuffer[index].length > 1){
      // TODO : what do we do exactly with the message ?
    }

    this.safeNeighbours.forEach(neighbour => {
      this.send(neighbour.id, m)
    });
  }

  // TODO : not sure this is correct
  R_broadcast(message){
    this.received.push(m)
    this.safeNeighbours.forEach(p => {
      this.send(m, p)
    });
    this.R_deliver(m)
  }

  open(q){
    if (this.safeNeighbours.length > 0) {
      this.pingCounter = this.pingCounter + 1
      messagesBuffer.addUser(q)                   
      this.ping(this.options.id, q, this.pingCounter)
    }
  }

  // TODO : not sure this is correct
  receivePing(from, to, id){
    this.pong(from, to, id)
  }

  receivePong(from, to, id){
    var index = this.messagesBuffer.indexOf(user => user[0] === to)
    if(index != -1){
      for(var i = 1; i < this.messagesBuffer[index].length; i++){
        this.send(to, this.messagesBuffer[index][i])
      }
      this.messagesBuffer.splice(index, 1)
      this.safeNeighbours.push(to)
    }
  }

  close(q){
    var index = this.messagesBuffer.indexOf(user => user[0] === q)
    this.messagesBuffer.splice(index, 1)
  }

  PC_broadcast(m){
    this.R_broadcast(m)
  }

  R_deliver(m){
    this.messagesBuffer.forEach(q =>{
      this.messagesBuffer[q].push(m)
    })
    this.PC_deliver(m)
  }

  ping(from, to, id){
    const result = this.nbRetries.find(user => user[0] === from)
    if (result != null){
      var index = this.nbRetries.indexOf(user => user[0] === from)
      this.nbRetries[index].splice(2, 1, 0)
    }
    var index = this.messageId.indexOf(message => message[0] === id)
    this.messageId[index].splice(2, 1, to)
  }

  receiveAck(from, to, id){
    var index = this.messageId.indexOf(message => message[0] === id)
    this.messageId.splice(index, 1)
    var index = this.nbRetries.indexOf(message => message[0] === to)
    this.nbRetries.splice(index, 1)
  }

  PC_deliver(m){
    this.messagesBuffer.forEach(q =>{
      if(this.messagesBuffer[q].length > maxSize){
        this.rety(q)
      }
    })
  }

  close(q){
    var index = this.bufferedMessage.indexOf(user => user[0] === q)
    this.bufferMessage.slice(index, 1)
    var index = this.messageId.indexOf(message => message[0] === q)
    this.messageId.slice(index, 1)
    var index = this.nbRetries.indexOf(message => message[0] === q)
    this.nbRetries.splice(index, 1)
  }

  retry(q){
    var index = this.messageId.indexOf(message => message[0] === q)
    this.messageId.slice(index, 1)
    var index = this.messagesBuffer.indexOf(user => user[0] === q)
    if(result != null){
      this.messagesBuffer[index].splice(2,1,this.messagesBuffer[index][1] +1)
      if(this.messagesBuffer[index][1] < this.maxRetry){
        this.open(q)
      }else{
        this.close(q)
      }
    }
  }

  timeout(from, to, id){
    const result = this.nbRetries.find(message => message[0] === id)
    if(result != null){
      this.retry(to)
    }
  }
}

module.exports = Broadcast
