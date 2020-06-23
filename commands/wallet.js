const path = require('path');
const fs = require('fs');
const {Writable} = require('stream');
const os = require('os');

const read = require('read');
const mkdirp = require('mkdirp');

const lightwallet = require('../eth-lightwallet');
const {makePromise, createKeystore} = require('../utils');

const _exportKeyStore = ks => ks.serialize();
module.exports = {
  command: 'wallet',
  describe: 'set up blockchain wallet',
  builder: {},
  handler: async () => {
    const mutableStdout = new Writable({
      write: function(chunk, encoding, callback) {
        if (!this.muted) { process.stdout.write(chunk, encoding); }
        callback();
      },
    });
    mutableStdout.muted = false;

    const p = makePromise();
    read({prompt: 'seed phrase (BIP39 format, default: auto): ', silent: true}, function(er, seedPhrase) {
      if (!er) {
        p.accept(seedPhrase);
      } else {
        p.reject(er);
      }
    });
    let seedPhrase = await p;
    if (seedPhrase) {
      if (!lightwallet.keystore.isSeedValid(seedPhrase)) {
        throw 'seed phrase is invalid; must be BIP39 format';
      }
    } else {
      seedPhrase = lightwallet.keystore.generateRandomSeed();
      console.log(seedPhrase);
      console.log('☝️ this is your autogenerated seed phrase; write it down');
    }

    const p2 = makePromise();
    read({prompt: 'password (used to encrypt seed phrase): ', silent: true}, function(er, password) {
      if (!er) {
        p2.accept(password);
      } else {
        p2.reject(er);
      }
    });
    const password = await p2;

    const p3 = makePromise();
    if (password) {
      const ks = await createKeystore(seedPhrase, password);
      await mkdirp(os.homedir());
      fs.writeFile(path.join(os.homedir(), '.xrpackage-wallet'), _exportKeyStore(ks), err => {
        if (!err) {
          p3.accept();
        } else {
          p3.reject(err);
        }
      });
      console.log(`0x${ks.addresses[0]}`);
    } else {
      p3.reject(new Error('password is required'));
    }
    await p3;
  },
};
