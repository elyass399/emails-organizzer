import { defineEventHandler, getRouterParams, setResponseStatus } from 'h3'
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
    const user = await serverSupabaseUser(event)
    const supabase = await serverSupabaseClient(event)
    const { id: conversationId } = getRouterParams(event)

    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const { data: staffProfile } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (!staffProfile || staffProfile.role !== 'admin') {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin privileges required.' })
    }

    if (!conversationId) {
        throw createError({ statusCode: 400, statusMessage: 'Missing conversation ID' })
    }

    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

    if (error) {
        console.error('Error deleting conversation:', error)
        throw createError({ statusCode: 500, statusMessage: 'Could not delete conversation' })
    }
    
    setResponseStatus(event, 204) // 204 No Content è la risposta standard per un DELETE riuscito
    return 
})