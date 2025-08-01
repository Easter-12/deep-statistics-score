import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Check if the request method is POST. If not, deny access.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Create a secure, server-side Supabase client
  const supabase = createPagesServerClient({ req, res });

  // 3. Get the user's session from their cookie
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 4. Get the access code from the request body
  const { accessCode } = req.body;
  if (!accessCode) {
      return res.status(400).json({ error: 'Access code is required.' });
  }

  let newUserType: string;
  let newCoins: number;

  // 5. Check the access code and set the new user type and coins
  if (accessCode === '12345678') { // Premium PIN
    newUserType = 'premium';
    newCoins = 4;
  } else if (accessCode === '2580') { // Unlimited Password
    newUserType = 'unlimited';
    newCoins = 8;
  } else {
    return res.status(400).json({ error: 'Invalid PIN or Password.' });
  }

  // 6. Update the user's profile in the database
  const { data, error } = await supabase
    .from('profiles')
    .update({ user_type: newUserType, coins_remaining: newCoins })
    .eq('id', session.user.id)
    .select() // Ask the database to return the updated profile
    .single();

  if (error) {
    console.error('Error upgrading account:', error);
    return res.status(500).json({ error: 'Database error while upgrading account.' });
  }

  // 7. Send a success message back to the user's app
  res.status(200).json({ message: `Account upgraded to ${newUserType}!`, profile: data });
}