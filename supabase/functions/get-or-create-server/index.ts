import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { bet_amount_param } = await req.json()

    // Try to find an existing server with available slots
    const { data: existingServer } = await supabaseClient
      .from('game_servers')
      .select('id, current_players, max_players')
      .eq('bet_amount', bet_amount_param)
      .eq('status', 'waiting')
      .lt('current_players', 'max_players')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (existingServer) {
      return new Response(
        JSON.stringify(existingServer.id),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Create new server if none available
    const { data: newServer, error } = await supabaseClient
      .from('game_servers')
      .insert({
        server_name: `Server ${Date.now()}`,
        bet_amount: bet_amount_param,
        status: 'waiting'
      })
      .select('id')
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify(newServer.id),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})