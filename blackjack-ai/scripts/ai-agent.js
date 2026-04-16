function parseEnvFile(content) {
  const config = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...parts] = line.split('=');
    const value = parts.join('=').trim().replace(/^["']|["']$/g, '');
    config[key.trim()] = value;
  });
  return config;
}

function formatCard(card) { return `${card.rank}${card.suit}`; }
function formatHand(hand) { return hand.cards.map(formatCard).join(', '); }

function buildGameStatePrompt(state) {
  return `Analyze this Blackjack game state and recommend the optimal action.

CURRENT GAME STATE:
Player Hand: ${formatHand(state.playerHand)}
Player Total: ${state.playerHand.getValue()}
Dealer Visible Card: ${formatCard(state.dealerHand.cards[0])}
Current Bet: $${state.currentBet}
Player Balance: $${state.balance}

GAME CONTEXT:
- Deck is shuffled after each hand (no card counting advantage)
- Dealer hits on soft 17
- Blackjack pays 3:2
- Doubling allowed on any two cards
- Splitting allowed on pairs

REQUIRED OUTPUT:
Provide a JSON response with:
1. "action": The recommended action (hit/stand/double/split)
2. "confidence": Confidence level (0-1)
3. "reasoning": Detailed explanation of why this is the best move
4. "expectedValue": Estimated EV of this action
5. "alternativeActions": Array of alternative moves with their EVs and confidence
6. "riskAssessment": Risk level (low/medium/high)
7. "cardCountingContext": Any relevant context

Consider basic strategy charts, probability of busting, dealer bust probability, and expected value.`;
}

async function getAIRecommendation(state, apiKey) {
  const model = state.modelName || 'gpt-4-turbo-preview';
  const start = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Blackjack strategist. Analyze the game state and provide optimal play recommendations following basic strategy. Always respond in valid JSON format.'
        },
        { role: 'user', content: buildGameStatePrompt(state) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || response.statusText;

    if (response.status === 429) throw Object.assign(new Error('Rate limit reached. Please wait a moment.'), { code: 'rate_limit' });
    if (response.status === 401) throw Object.assign(new Error('Invalid API key. Please upload a valid .env file.'), { code: 'auth' });
    throw new Error(`API Error: ${msg}`);
  }

  const data = await response.json();
  const rec = JSON.parse(data.choices[0].message.content);
  rec.responseTime = Date.now() - start;
  return rec;
}

function getFallbackStrategy(playerTotal, dealerUpcard, canDouble, canSplit, playerHand) {
  const d = dealerUpcard;
  let action = 'stand';

  if (canSplit && playerHand.cards[0].rank === 'A') { action = 'split'; }
  else if (canSplit && playerHand.cards[0].rank === '8') { action = 'split'; }
  else if (playerTotal <= 11) {
    if (playerTotal === 11) action = canDouble ? 'double' : 'hit';
    else if (playerTotal === 10 && d <= 9) action = canDouble ? 'double' : 'hit';
    else if (playerTotal === 9 && d >= 3 && d <= 6) action = canDouble ? 'double' : 'hit';
    else action = 'hit';
  } else if (playerTotal === 12) { action = (d >= 4 && d <= 6) ? 'stand' : 'hit'; }
  else if (playerTotal <= 16) { action = (d >= 2 && d <= 6) ? 'stand' : 'hit'; }
  else { action = 'stand'; }

  return {
    action,
    confidence: 0.8,
    reasoning: 'Using basic strategy (AI unavailable)',
    expectedValue: -0.1,
    alternativeActions: [],
    riskAssessment: playerTotal >= 15 ? 'high' : 'medium',
    source: 'fallback'
  };
}
