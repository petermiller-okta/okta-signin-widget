import { RequestLogger, RequestMock, Selector } from 'testcafe';
import DeviceChallengePollPageObject from '../framework/page-objects/DeviceChallengePollPageObject';
import identifyWithDeviceProbingLoopback from '../../../playground/mocks/idp/idx/data/identify-with-device-probing-loopback';
import loopbackChallengeNotReceived from '../../../playground/mocks/idp/idx/data/identify-with-device-probing-loopback-challenge-not-received';

let failureCount = 0;

const logger = RequestLogger(/introspect|probe|challenge/);

const mock = RequestMock()
  .onRequestTo('http://localhost:3000/idp/idx/introspect')
  .respond(identifyWithDeviceProbingLoopback)
  .onRequestTo('http://localhost:3000/idp/idx/authenticators/poll')
  .respond((req, res) => {
    res.statusCode = '200';
    if (failureCount === 2) {
      res.setBody(loopbackChallengeNotReceived);
    } else {
      res.setBody(identifyWithDeviceProbingLoopback);
    }
  })
  .onRequestTo('http://localhost:2000/probe')
  .respond(null, 500, { 'access-control-allow-origin': '*' })
  .onRequestTo('http://localhost:6511/probe')
  .respond(null, 500, { 'access-control-allow-origin': '*' })
  .onRequestTo('http://localhost:6512/probe')
  .respond(null, 200, { 'access-control-allow-origin': '*' })
  .onRequestTo('http://localhost:6512/challenge')
  .respond(null, 200, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Origin, X-Requested-With, Content-Type, Accept',
    'access-control-allow-methods': 'POST, OPTIONS'
  })

fixture(`Device Challenge Polling View`)
  .requestHooks(logger, mock)

async function setup(t) {
  const deviceChallengePollPage = new DeviceChallengePollPageObject(t);
  await deviceChallengePollPage.navigateToPage();
  return deviceChallengePollPage;
}

test
  (`probing and polling APIs are sent and responded`, async t => {
    const deviceChallengePollPageObject = await setup(t);
    await t.expect(deviceChallengePollPageObject.getHeader()).eql('Sign In');
    await t.expect(logger.count(
      record => record.response.statusCode === 200 &&
      record.request.url.match(/introspect|6512/)
    )).eql(3);
    failureCount = 2;
    await t.expect(logger.count(
      record => record.response.statusCode === 500 &&
      record.request.url.match(/2000|6511/)
    )).eql(2);
    await t.expect(logger.contains(record => record.request.url.match(/6513/))).eql(false);
    // replace with custom uri page object OKTA-258116
    const form = new Selector('.o-form').nth(0);
    await t.expect(form.find('input[name="identifier"]').exists).eql(true);
  })