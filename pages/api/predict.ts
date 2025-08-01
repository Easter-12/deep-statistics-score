import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { tavily } from '@tavily/core'; // Correct import
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

        // --- THE FIX IS HERE ---
        const chatCompletion = await groq.chat.completions.create({
            messages: [{
                role: 'user',
                content: `You are an expert sports data analyst, "Deep Statistics Score". Analyze the provided data for the match between ${teamA} and ${teamB}. Data: --- ${compiledStats} --- Based ONLY on this data, provide your response as a single, raw JSON object and nothing else. Do not use markdown like \`\`\`json. Your response must contain these 8 keys: "fullTimeWinner", "halfTimeWinner", "overUnderGoals", "correctScoreSuggestion", "bothTeamsToScore", "doubleChance", "handicapResult", "keyInsights". Each key's value must be an object with "prediction" and either "probability" or "reasoning".`
            }],
            model: 'llama3-8b-8192',
            // We REMOVED the strict 'response_format' that was causing the error.
        });

        const responseText = chatCompletion.choices[0]?.message?.content;
        if (!responseText) throw new Error("The AI returned an empty response.");

        // This robustly finds the JSON within the AI's text response.
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not find JSON in the AI response.");

        const predictionJson = JSON.parse(jsonMatch[0]);
        res.status(200).json(predictionJson);

    } catch (error: any) {
        console.error("API Error:", error);
        res.status(500).json({ error: "An error occurred during prediction.", details: error.message });
    }
}