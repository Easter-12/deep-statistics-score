import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { tavily } from '@tavily/core';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { teamA, teamB } = req.body;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!teamA || !teamB) return res.status(400).json({ error: 'Please provide two team names.' });

    const supabase = createPagesServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('coins_remaining').eq('id', session.user.id).single();
        if (profileError || !profile) throw new Error('Could not fetch your user profile.');
        if (profile.coins_remaining <= 0) return res.status(403).json({ error: 'No coins remaining.' });

        const { error: updateError } = await supabase.from('profiles').update({ coins_remaining: profile.coins_remaining - 1 }).eq('id', session.user.id);
        if (updateError) throw new Error('Could not update coin count.');

        const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
        const searchContext = await tavilyClient.search(`Detailed stats, recent form, H2H, and injury news for the soccer match between ${teamA} and ${teamB}`, { maxResults: 10 });
        const compiledStats = searchContext.results.map(r => r.content).join('\n\n---\n\n');

        // --- THE NEW, SMARTER PROMPT ---
        const chatCompletion = await groq.chat.completions.create({
            messages: [{
                role: 'user',
                content: `You are an expert sports data analyst, "Deep Statistics Score". Your most important task is to provide a set of predictions that are all **logically consistent** with each other.

                Analyze the provided data for the match between ${teamA} and ${teamB}.
                Data:
                ---
                ${compiledStats}
                ---

                Based on the data, first decide on a single, core prediction (e.g., "${teamA} to win 2-1"). Then, ensure all 8 of your output predictions support that single narrative. For example, if you predict a 2-1 score, "Both Teams To Score" must be "Yes" and "Over/Under Goals" should likely be "Over 2.5".

                Provide your response as a single, raw JSON object and nothing else. Do not use markdown like \`\`\`json.

                Your response must contain these 8 keys: "fullTimeWinner", "halfTimeWinner", "overUnderGoals", "correctScoreSuggestion", "bothTeamsToScore", "doubleChance", "handicapResult", "keyInsights". The "keyInsights" should summarize the core reasoning for your consistent set of predictions.`
            }],
            model: 'llama3-8b-8192',
        });

        const responseText = chatCompletion.choices[0]?.message?.content;
        if (!responseText) throw new Error("The AI returned an empty response.");

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not find JSON in the AI response.");

        const predictionJson = JSON.parse(jsonMatch[0]);
        res.status(200).json(predictionJson);

    } catch (error: any) {
        console.error("API Error:", error);
        res.status(500).json({ error: "An error occurred during prediction.", details: error.message });
    }
}